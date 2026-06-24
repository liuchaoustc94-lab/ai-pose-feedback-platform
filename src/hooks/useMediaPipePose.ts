import { useEffect, useRef, useState, useCallback } from 'react'
import { Pose } from '@mediapipe/pose'
import type { Results, NormalizedLandmark } from '@mediapipe/pose'
import {
  extractMetrics,
  generateReport,
  type PoseMetrics,
  type PoseReport,
} from '../lib/poseMetrics'

export interface CameraPreviewInfo {
  width: number
  height: number
  readyState: number
  paused: boolean
  deviceLabel: string
}

export function useMediaPipePose() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const poseRef = useRef<Pose | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRequestRef = useRef<number | null>(null)
  const processingFrameRef = useRef(false)
  const lastPreviewUpdateRef = useRef(0)
  const isDetectingRef = useRef(false)
  const metricsRef = useRef<PoseMetrics[]>([])

  const [isReady, setIsReady] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [currentMetrics, setCurrentMetrics] = useState<PoseMetrics | null>(null)
  const [report, setReport] = useState<PoseReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [previewInfo, setPreviewInfo] = useState<CameraPreviewInfo | null>(null)

  useEffect(() => {
    isDetectingRef.current = isDetecting
  }, [isDetecting])

  const refreshVideoDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return

    const devices = await navigator.mediaDevices.enumerateDevices()
    setVideoDevices(devices.filter((device) => device.kind === 'videoinput'))
  }, [])

  const onResults = useCallback((results: Results) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (canvas.width === 0 || canvas.height === 0 || video.videoWidth === 0 || video.videoHeight === 0) return

    if (results.poseLandmarks) {
      // Visibility guard helper
      const vis = (lm: NormalizedLandmark | undefined) =>
        !!lm && typeof lm.visibility === 'number' && lm.visibility > 0.5

      // Draw skeleton connections
      const connections = [
        [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
        [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
        [24, 26], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32],
      ]

      ctx.strokeStyle = '#0a4fff'
      ctx.lineWidth = 3
      ctx.globalAlpha = 0.8

      for (const [start, end] of connections) {
        const startLm = results.poseLandmarks[start]
        const endLm = results.poseLandmarks[end]
        if (startLm && endLm && vis(startLm) && vis(endLm)) {
          ctx.beginPath()
          ctx.moveTo(startLm.x * canvas.width, startLm.y * canvas.height)
          ctx.lineTo(endLm.x * canvas.width, endLm.y * canvas.height)
          ctx.stroke()
        }
      }

      // Draw joint points
      const keyJoints = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
      for (const idx of keyJoints) {
        const lm = results.poseLandmarks[idx]
        if (lm && vis(lm)) {
          ctx.beginPath()
          ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 5, 0, Math.PI * 2)
          ctx.fillStyle = idx === 0 ? '#dc2f1b' : '#ffffff'
          ctx.fill()
          ctx.strokeStyle = '#0a4fff'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }

      // Draw angle labels for key joints
      const drawAngleLabel = (lmIndex: number, angle: number | null, label: string) => {
        if (angle === null) return
        const lm = results.poseLandmarks[lmIndex]
        if (!lm || !vis(lm)) return
        ctx.fillStyle = 'rgba(220, 47, 27, 0.9)'
        ctx.font = '12px ui-monospace, monospace'
        const text = `${label}: ${angle}°`
        const textWidth = ctx.measureText(text).width
        ctx.fillRect(
          lm.x * canvas.width - textWidth / 2 - 4,
          lm.y * canvas.height - 18,
          textWidth + 8,
          18
        )
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.fillText(text, lm.x * canvas.width, lm.y * canvas.height - 5)
      }

      ctx.globalAlpha = 1

      // Extract and store metrics
      const metrics = extractMetrics(results)
      if (metrics) {
        setCurrentMetrics(metrics)
        if (isDetectingRef.current) {
          metricsRef.current.push(metrics)
        }

        // Draw angles on canvas
        if (isDetectingRef.current) {
          drawAngleLabel(25, metrics.kneeAngle.left, '膝')
          drawAngleLabel(26, metrics.kneeAngle.right, '膝')
          drawAngleLabel(13, metrics.elbowAngle.left, '肘')
          drawAngleLabel(14, metrics.elbowAngle.right, '肘')
        }
      }
    }
  }, [])

  const initPose = useCallback(async () => {
    try {
      setError(null)
      const pose = new Pose({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        },
      })

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

      pose.onResults(onResults)
      poseRef.current = pose
      setIsReady(true)
    } catch (err) {
      setError('初始化姿态检测失败，请检查网络连接')
      console.error(err)
    }
  }, [onResults])

  const startCamera = useCallback(async () => {
    const video = videoRef.current
    if (!video || !poseRef.current) return

    try {
      setError(null)

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : true,
      })

      streamRef.current = stream
      void refreshVideoDevices()

      const waitForMetadata = new Promise<void>((resolve) => {
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          resolve()
          return
        }

        video.addEventListener('loadedmetadata', () => resolve(), { once: true })
      })

      video.srcObject = stream
      video.muted = true
      video.playsInline = true

      await Promise.race([
        waitForMetadata,
        new Promise<void>((resolve) => window.setTimeout(resolve, 1200)),
      ])

      await Promise.race([
        video.play(),
        new Promise<void>((resolve) => window.setTimeout(resolve, 1200)),
      ])

      setCameraActive(true)

      const processFrame = async () => {
        const activeVideo = videoRef.current
        const pose = poseRef.current

        if (!activeVideo || !pose || !streamRef.current) return

        if (
          activeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          activeVideo.videoWidth > 0 &&
          activeVideo.videoHeight > 0
        ) {
          const canvas = canvasRef.current
          const ctx = canvas?.getContext('2d')
          if (canvas && ctx) {
            if (canvas.width !== activeVideo.videoWidth) {
              canvas.width = activeVideo.videoWidth
            }
            if (canvas.height !== activeVideo.videoHeight) {
              canvas.height = activeVideo.videoHeight
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(activeVideo, 0, 0, canvas.width, canvas.height)
          }
        }

        if (
          activeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          activeVideo.videoWidth > 0 &&
          activeVideo.videoHeight > 0 &&
          !processingFrameRef.current
        ) {
          processingFrameRef.current = true
          try {
            await pose.send({ image: activeVideo })
          } finally {
            processingFrameRef.current = false
          }
        }

        const now = Date.now()
        if (now - lastPreviewUpdateRef.current > 1000) {
          lastPreviewUpdateRef.current = now
          const track = streamRef.current.getVideoTracks()[0]
          const settings = track?.getSettings()
          setPreviewInfo({
            width: activeVideo.videoWidth,
            height: activeVideo.videoHeight,
            readyState: activeVideo.readyState,
            paused: activeVideo.paused,
            deviceLabel: track?.label || settings?.deviceId || '默认摄像头',
          })
        }

        frameRequestRef.current = requestAnimationFrame(processFrame)
      }

      frameRequestRef.current = requestAnimationFrame(processFrame)
    } catch (err) {
      setError('无法访问摄像头，请检查浏览器权限，或确认没有其他应用正在占用摄像头')
      console.error(err)
    }
  }, [refreshVideoDevices, selectedDeviceId])

  const stopCamera = useCallback(() => {
    if (frameRequestRef.current !== null) {
      cancelAnimationFrame(frameRequestRef.current)
      frameRequestRef.current = null
    }

    processingFrameRef.current = false

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    setCameraActive(false)
    setPreviewInfo(null)
  }, [])

  const startDetection = useCallback(() => {
    metricsRef.current = []
    setIsDetecting(true)
    setReport(null)
  }, [])

  const stopDetection = useCallback(() => {
    setIsDetecting(false)
    const report = generateReport(metricsRef.current)
    setReport(report)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void initPose()
      void refreshVideoDevices()
    }, 0)

    return () => {
      clearTimeout(timer)
      stopCamera()
    }
  }, [initPose, refreshVideoDevices, stopCamera])

  return {
    videoRef,
    canvasRef,
    isReady,
    isDetecting,
    currentMetrics,
    report,
    error,
    cameraActive,
    videoDevices,
    selectedDeviceId,
    previewInfo,
    setSelectedDeviceId,
    refreshVideoDevices,
    startCamera,
    stopCamera,
    startDetection,
    stopDetection,
  }
}
