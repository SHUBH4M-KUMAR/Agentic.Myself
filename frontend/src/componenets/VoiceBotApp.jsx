import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  RotateCcw,
  Loader2,
  Download
} from "lucide-react";

export default function VoiceBotApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioURL, setAudioURL] = useState("");
  const [error, setError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [userText, setUserText] = useState("");
  const [aiResponseText, setAiResponseText] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const typingIntervalRef = useRef(null);

  // Cleanup function
  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return cleanup;
  }, []);

  const startRecording = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunks.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.current.push(e.data);
        }
      };
      
      mediaRecorderRef.current.onstop = handleRecordingStop;
      
      mediaRecorderRef.current.start(250);
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      setError("Failed to access microphone. Please check permissions.");
      console.error("Recording error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      cleanup();
    }
  };

  const handleRecordingStop = async () => {
    if (audioChunks.current.length === 0) {
      setError("No audio data recorded. Please try again.");
      return;
    }

    const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
    
    if (audioBlob.size < 1000) {
      setError("Recording too short. Please record for at least 1 second.");
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    setUserText("");
    setAiResponseText("");
    setDisplayedText("");
    
    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("http://localhost:8000/voicebot", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        setUserText(data.userText || "");
        setAiResponseText(data.aiText || "");
        
        if (data.audioUrl) {
          setAudioURL(data.audioUrl);
        }
      } else {
        const audioBlobResponse = await response.blob();
        const newAudioURL = URL.createObjectURL(audioBlobResponse);
        
        if (audioURL) {
          URL.revokeObjectURL(audioURL);
        }
        
        setAudioURL(newAudioURL);
        setUserText("Audio recorded successfully");
        setAiResponseText("AI response ready to play");
      }
      
      setProcessingProgress(100);
      
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(console.error);
        }
      }, 500);
      
    } catch (err) {
      setError(`Failed to process audio: ${err.message}`);
      console.error("Processing error:", err);
    } finally {
      clearInterval(progressInterval);
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying && !isPaused) {
      audioRef.current.pause();
      setIsPaused(true);
    } else {
      audioRef.current.play();
      setIsPaused(false);
    }
  };

  const startTypingEffect = () => {
    if (!aiResponseText || typingIntervalRef.current) return;
    
    setDisplayedText("");
    setIsTyping(true);
    let currentIndex = 0;
    const words = aiResponseText.split(' ');
    
    const wordsPerSecond = audioRef.current?.duration ? 
      words.length / audioRef.current.duration : 
      1000 / 150;
    
    const intervalTime = Math.max(50, 1000 / wordsPerSecond);
    
    typingIntervalRef.current = setInterval(() => {
      if (currentIndex < words.length) {
        setDisplayedText(prev => {
          const newText = prev + (prev ? ' ' : '') + words[currentIndex];
          return newText;
        });
        currentIndex++;
      } else {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
        setIsTyping(false);
      }
    }, intervalTime);
  };

  const handleAudioPlay = () => {
    setIsPlaying(true);
    setIsPaused(false);
    startTypingEffect();
  };

  const handleAudioPause = () => {
    setIsPaused(true);
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    setIsTyping(false);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setIsPaused(false);
    setDisplayedText(aiResponseText);
    setIsTyping(false);
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const resetRecording = () => {
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
    setAudioURL("");
    setRecordingTime(0);
    setError("");
    setIsPlaying(false);
    setIsPaused(false);
    setIsMuted(false);
    setUserText("");
    setAiResponseText("");
    setDisplayedText("");
    setIsTyping(false);
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
  };

  const downloadAudio = () => {
    if (audioURL) {
      const a = document.createElement('a');
      a.href = audioURL;
      a.download = `voice-response-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800">
      {/* Floating Orbs Background - Optimized for performance */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-20 animate-pulse"
            style={{
              left: `${10 + (i * 7) % 80}%`,
              top: `${15 + (i * 11) % 70}%`,
              width: `${60 + (i % 3) * 40}px`,
              height: `${60 + (i % 3) * 40}px`,
              background: i % 3 === 0 
                ? 'radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.1) 70%, transparent 100%)'
                : i % 3 === 1
                ? 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, rgba(59, 130, 246, 0.1) 70%, transparent 100%)'
                : 'radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, rgba(168, 85, 247, 0.1) 70%, transparent 100%)',
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${4 + (i % 3)}s`,
              transform: `translate(-50%, -50%) scale(${0.8 + (i % 3) * 0.3})`,
            }}
          />
        ))}
      </div>

      {/* Subtle grid overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Main UI */}
      <div className="relative z-20 flex min-h-screen w-full items-center justify-center p-4">
        <Card className="w-full max-w-lg bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/20">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                {isRecording && (
                  <div className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping"></div>
                )}
              </div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                AI Voice Assistant
              </CardTitle>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Badge 
                variant="secondary" 
                className={`text-xs font-medium px-3 py-1 transition-all duration-300 ${
                  isRecording 
                    ? "bg-red-500/20 text-red-300 border-red-400/40 shadow-sm shadow-red-500/20" 
                    : isProcessing 
                      ? "bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-sm shadow-amber-500/20"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-sm shadow-emerald-500/20"
                }`}
              >
                {isRecording ? "🔴 Recording" : isProcessing ? "⚡ Processing" : "✅ Ready"}
              </Badge>
              {isRecording && (
                <Badge className="text-xs font-mono bg-gray-700/60 text-gray-300 border-gray-600/40 px-3 py-1">
                  {formatTime(recordingTime)}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert className="bg-red-500/10 border-red-400/30 text-red-300 shadow-sm">
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            {isProcessing && (
              <div className="space-y-4 p-4 bg-amber-500/5 rounded-xl border border-amber-400/20">
                <div className="flex items-center justify-center gap-3 text-sm text-amber-300">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                  <span className="font-medium">Processing your request...</span>
                </div>
                <Progress 
                  value={processingProgress} 
                  className="h-2 bg-gray-700/50 rounded-full overflow-hidden"
                />
              </div>
            )}

            {/* User's spoken text */}
            {userText && (
              <div className="space-y-3 p-4 bg-cyan-500/5 rounded-xl border border-cyan-400/20 backdrop-blur-sm transition-all duration-300 hover:bg-cyan-500/8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center shadow-md">
                    <span className="text-white text-sm font-bold">U</span>
                  </div>
                  <span className="text-sm font-semibold text-cyan-300">
                    You said:
                  </span>
                </div>
                <p className="text-sm text-cyan-100 leading-relaxed pl-11 font-medium">
                  {userText}
                </p>
              </div>
            )}

            {/* AI response text with typing effect */}
            {(aiResponseText || displayedText) && (
              <div className="space-y-3 p-4 bg-emerald-500/5 rounded-xl border border-emerald-400/20 backdrop-blur-sm transition-all duration-300 hover:bg-emerald-500/8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center shadow-md">
                    <span className="text-white text-sm font-bold">AI</span>
                  </div>
                  <span className="text-sm font-semibold text-emerald-300">
                    AI Response:
                  </span>
                  {isTyping && (
                    <div className="ml-auto flex gap-1">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                  )}
                </div>
                <p className="text-sm text-emerald-100 leading-relaxed pl-11 min-h-[1.25rem] font-medium">
                  {displayedText}
                  {isTyping && <span className="inline-block w-0.5 h-4 bg-emerald-400 ml-1 animate-pulse"></span>}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                size="lg"
                className={`flex-1 h-16 text-base font-semibold transition-all duration-300 border-0 shadow-lg ${
                  isRecording 
                    ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-red-500/30 transform hover:scale-105" 
                    : "bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white shadow-emerald-500/30 transform hover:scale-105"
                }`}
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-6 h-6 mr-3" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="w-6 h-6 mr-3" />
                    Start Recording
                  </>
                )}
              </Button>

              {(audioURL || isRecording) && (
                <Button
                  onClick={resetRecording}
                  variant="outline"
                  size="lg"
                  className="h-16 px-5 bg-gray-700/40 border-gray-600/40 text-gray-300 hover:bg-gray-600/50 hover:text-white transition-all duration-300 hover:scale-105"
                  disabled={isProcessing}
                >
                  <RotateCcw className="w-6 h-6" />
                </Button>
              )}
            </div>

            {audioURL && (
              <div className="space-y-4 p-5 bg-gray-700/20 rounded-xl border border-gray-600/30 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                    <span className="text-lg">🤖</span>
                    AI Response Audio
                  </span>
                  <div className="flex gap-2">
                    <Button
                      onClick={toggleMute}
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-gray-400 hover:text-white hover:bg-gray-600/50 rounded-full transition-all duration-200"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                    <Button
                      onClick={downloadAudio}
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-gray-400 hover:text-white hover:bg-gray-600/50 rounded-full transition-all duration-200"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Button
                    onClick={togglePlayPause}
                    variant="outline"
                    size="sm"
                    className="h-12 w-12 p-0 rounded-full bg-gray-600/40 border-gray-500/40 text-gray-300 hover:bg-gray-500/50 hover:text-white transition-all duration-200 hover:scale-105"
                  >
                    {isPlaying && !isPaused ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </Button>

                  <audio
                    ref={audioRef}
                    src={audioURL}
                    onPlay={handleAudioPlay}
                    onPause={handleAudioPause}
                    onEnded={handleAudioEnded}
                    controls
                    className="flex-1 h-12 rounded-lg"
                    preload="metadata"
                  />
                </div>
              </div>
            )}

            <div className="text-center text-sm text-gray-400 bg-gray-800/30 rounded-lg p-3 border border-gray-700/30">
              💡 <span className="font-medium">Click the microphone to start a conversation with the AI assistant</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}