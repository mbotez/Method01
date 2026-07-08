import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Send, ArrowLeft, Camera, X, Info, Trash2, Check, ArrowRight } from 'lucide-react';
import { BREAKOUT_PHOTO_OPTIONS } from '../data/breakoutOptions';
import { supabase } from '../lib/supabase';
import { mapAnswersToProfile, generateSkinReportText } from '../skin_report';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  type?: 'text' | 'options' | 'breakout_options' | 'scan_results';
  options?: string[];
  scanResults?: any;
  timestamp: number;
  showBack?: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

interface Step {
  id: string;
  title: string;
  type: 'single' | 'multiple' | 'age' | 'tone' | 'text' | 'search_products';
  key: string;
  options?: string[];
  condition?: (answers: any) => boolean;
  part: number;
}

const ALL_STEPS: Step[] = [
  {
    id: 'feel',
    title: "First things first, let's look at your skin. How does it feel right after you wash your face in the morning?",
    type: 'single',
    key: 'feel',
    options: ['Dry and tight', 'Oily all over', 'Oily forehead and nose, but dry cheeks'],
    part: 1
  },
  {
    id: 'sun',
    title: "How does your skin usually react to the sun?",
    type: 'single',
    key: 'sun',
    options: ["I burn like a lobster", 'Burn then tan', 'Got no problems tanning'],
    part: 1
  },
  {
    id: 'sensitivity',
    title: "Got any skin sensitivity issues? Feel free to select all that apply.",
    type: 'multiple',
    key: 'sensitivity',
    options: ['Burning or stinging from products', 'Redness', 'Itching', 'Flaking or peeling', 'Tightness even after moisturizing'],
    part: 2
  },
  {
    id: 'reaction',
    title: "How does your skin usually react when you try out new skincare products?",
    type: 'single',
    key: 'reaction',
    options: ['Very good, no problems', 'Sometimes sensitive', 'Often get redness, bumps, or burning', 'Almost everything irritates my skin'],
    part: 2
  },
  {
    id: 'mainConcern',
    title: "What's the main skin concern you're looking to tackle?",
    type: 'single',
    key: 'mainConcern',
    options: ['Acne and scars', 'Redness', 'Dark Spots', 'Dullness', 'Dryness', 'Oily skin', 'Wrinkles & fine lines', 'Large pores & texture', 'Sensitivity', 'Eczema', 'Fungal acne', 'Not sure'],
    part: 3
  },
  {
    id: 'scndConcern',
    title: "Any other concerns we should keep in mind?",
    type: 'single',
    key: 'scndConcern',
    options: ['Acne and scars', 'Redness', 'Dark Spots', 'Dullness', 'Dryness', 'Oily skin', 'Wrinkles & fine lines', 'Large pores & texture', 'Sensitivity', 'Eczema', 'Fungal acne', 'Not sure'],
    condition: (ans) => ans.mainConcern,
    part: 3
  },
  {
    id: 'breakoutType',
    title: "If you get breakouts, what do they usually look like?",
    type: 'single',
    key: 'breakoutType',
    options: ['whiteheads', 'blackheads', 'pie', 'pih', 'papules', 'conglo', 'pustules', 'nodules', 'cystic', 'none'],
    condition: (ans) => ans.mainConcern === 'Acne and scars' || ans.scndConcern === 'Acne and scars',
    part: 3
  },
  {
    id: 'breakoutWhere',
    title: "And where do those breakouts tend to pop up?",
    type: 'single',
    key: 'breakoutWhere',
    options: ['Forehead', 'Nose', 'Chin/jawline', 'Cheeks', 'Chest/back'],
    condition: (ans) => ans.mainConcern === 'Acne and scars' || ans.scndConcern === 'Acne and scars',
    part: 3
  },
  {
    id: 'env',
    title: "What's the climate like where you live?",
    type: 'single',
    key: 'env',
    options: ['Hot & humid', 'Hot & dry', 'Cold & dry', 'Mild'],
    part: 4
  },
  {
    id: 'sunscreen',
    title: "How often do you apply sunscreen?",
    type: 'single',
    key: 'sunscreen',
    options: ['Every day', 'Sometimes', 'Never'],
    part: 4
  },
  {
    id: 'makeup',
    title: "How often do you wear makeup?",
    type: 'single',
    key: 'makeup',
    options: ['Every day', 'Sometimes', 'Never'],
    part: 4
  },
  {
    id: 'activesUsed',
    title: "Are you using any active treatments right now? Select all that apply.",
    type: 'multiple',
    key: 'activesUsed',
    options: [
      'Prescription retinoids (tretinoin, adapalene etc)',
      'Over-the-counter retinols',
      'Exfoliating acids (salicylic, glycolic etc)',
      "None/ I'm not sure"
    ],
    part: 4
  },
  {
    id: 'currentProducts',
    title: "What products are in your current routine?",
    type: 'search_products',
    key: 'currentProducts',
    part: 4
  },
  {
    id: 'pastProblems',
    title: "Any specific ingredients you'd like to avoid because of past issues?",
    type: 'text',
    key: 'pastProblems',
    part: 4
  },
  {
    id: 'age',
    title: "Lastly, how old are you?",
    type: 'age',
    key: 'age',
    part: 6
  }
];

export const ChatQuestionnaire = ({
  onComplete
}: {
  onComplete: (answers: any) => void;
}) => {
  const [answers, setAnswers] = useState<any>({
    mainConcern: null,
    scndConcern: null,
    sensitivity: [],
    currentProducts: [],
    breakoutType: [],
    activesUsed: []
  });
  const [stepIndex, setStepIndex] = useState(0);

  const activeSteps = ALL_STEPS.filter(
    (step) => !step.condition || step.condition(answers)
  );
  const currentStep = activeSteps[stepIndex] || activeSteps[activeSteps.length - 1];

  const updateAnswer = (key: string, value: any) => {
    setAnswers((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (stepIndex < activeSteps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      setIsScanningFace(true);
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const addUserMessage = (text: string) => {
    const userMsg: Message = {
      id: generateId(),
      sender: 'user',
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
  };
  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState('');
  const [debouncedProductSearchQuery, setDebouncedProductSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastStepIdRef = useRef<string | null>(null);
  const [isScanningFace, setIsScanningFace] = useState(false);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scanFlow, setScanFlow] = useState<'front' | 'closeup' | 'analysis'>('front');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [frontPhoto, setFrontPhoto] = useState<string | null>(answers.front_photo || null);
  const [closeUpPhoto, setCloseUpPhoto] = useState<string | null>(answers.close_up_photo || null);
  const [isScanning, setIsScanning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStepName, setScanStepName] = useState("");
  const [photoVerificationError, setPhotoVerificationError] = useState<string | null>(null);
  const [cameraTarget, setCameraTarget] = useState<'front' | 'closeup'>('front');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [rednessScore, setRednessScore] = useState(0);
  const [wrinklesScore, setWrinklesScore] = useState(0);
  const [rednessMainArea, setRednessMainArea] = useState('Cheeks');
  const [wrinklesMainArea, setWrinklesMainArea] = useState('Forehead');
  const [scanAcneType, setScanAcneType] = useState('None');

  useEffect(() => {
    if (isScanningFace) {
      if (answers.front_photo) {
        setFrontPhoto(answers.front_photo);
      } else {
        startCamera('front');
      }
    } else {
      stopCamera();
    }
  }, [isScanningFace]);

  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const closeupFileInputRef = useRef<HTMLInputElement>(null);
  const cameraErrorFileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async (target: 'front' | 'closeup' = 'front') => {
    setCameraTarget(target);
    setIsCameraActive(true);
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera access is not supported on this device or browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.log("Error accessing camera:", err);
      setCameraError("Camera access denied or unavailable. Please check your browser permissions, ensure a camera is connected, or try opening the app in a new tab if you are using an embedded preview.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, -canvas.width, 0);
        const base64Data = canvas.toDataURL("image/jpeg", 0.85);
        if (cameraTarget === 'front') {
            setFrontPhoto(base64Data);
            setCameraTarget('closeup');
            setScanFlow('closeup');
        } else {
            setCloseUpPhoto(base64Data);
            stopCamera();
            setScanFlow('analysis');
        }
      }
    }
  };

  const compressImage = (base64Str: string, maxWidth = 1000, maxHeight = 1000): Promise<string> => {
    return new Promise((resolve) => {
      if (!base64Str || base64Str.startsWith("http")) {
        resolve(base64Str);
        return;
      }
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => {
        resolve(base64Str);
      };
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isFront: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isFront) {
      setPhotoVerificationError(null);
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      try {
        const compressed = await compressImage(base64Data);
        if (isFront) {
          setFrontPhoto(compressed);
        } else {
          setCloseUpPhoto(compressed);
        }
      } catch (err) {
        if (isFront) {
          setFrontPhoto(base64Data);
        } else {
          setCloseUpPhoto(base64Data);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const loadDemoPhoto = (isFront: boolean) => {
    const demoFront64 = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400";
    const demoCloseUp64 = "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&q=80&w=400";
    
    if (isFront) {
      setPhotoVerificationError(null);
      setFrontPhoto(demoFront64);
    } else {
      setCloseUpPhoto(demoCloseUp64);
    }
  };

  const startDermalScan = async (overridePhoto?: string) => {
    const photoToUse = overridePhoto || frontPhoto;
    if (!photoToUse) return;

    setIsScanning(true);
    setScanProgress(5);
    setScanStepName("Initializing dermal core scanner...");

    let progressVal = 5;
    const progressInterval = setInterval(() => {
      progressVal += Math.floor(Math.random() * 8) + 3;
      if (progressVal > 92) {
        progressVal = 92;
      }
      setScanProgress(progressVal);

      if (progressVal < 30) {
        setScanStepName("Scanning luminance & contrast...");
      } else if (progressVal < 55) {
        setScanStepName("Isolating pigment coordinates...");
      } else if (progressVal < 75) {
        setScanStepName("Analyzing wrinkles alignment...");
      } else {
        setScanStepName("Refining comedonal classification...");
      }
    }, 450);

    try {
      const response = await fetch("/api/analyze-face", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          frontImage: photoToUse,
          closeUpImage: closeUpPhoto,
          userAnswers: answers,
        }),
      });

      clearInterval(progressInterval);
      const data = await response.json();

      if (data.success) {
        if (!data.face_detected) {
          setIsScanning(false);
          setPhotoVerificationError(data.explanation || "No human face could be identified. Please make sure your face is clearly visible in the frame.");
          setFrontPhoto(null);
          return;
        }

        if (data.face_too_small) {
          setIsScanning(false);
          setPhotoVerificationError(data.explanation || "The identified face is too small. Please position the camera closer to ensure high accuracy analysis.");
          setFrontPhoto(null);
          return;
        }

        setScanProgress(100);
        setScanStepName("Clinical assessment complete!");

        addBotMessage({
          id: 'scan_complete',
          title: "Dermal scan complete"
        }, {
          redness_score: data.redness_score,
          redness_main_area: data.redness_main_area,
          wrinkles_score: data.wrinkles_score,
          wrinkles_main_area: data.wrinkels_main_area,
          scan_acne_type: data.scan_acne_type
        });

        setRednessScore(data.redness_score);
        setWrinklesScore(data.wrinkles_score);
        setRednessMainArea(data.redness_main_area);
        setWrinklesMainArea(data.wrinkels_main_area);
        setScanAcneType(data.scan_acne_type);

        const finalAnswers = {
          ...answers,
          redness_score: data.redness_score,
          wrinkles_score: data.wrinkles_score,
          redness_main_area: data.redness_main_area,
          wrinkels_main_area: data.wrinkels_main_area,
          scan_acne_type: data.scan_acne_type,
          front_photo: photoToUse,
          close_up_photo: closeUpPhoto,
        };
        setAnswers(finalAnswers);

        setTimeout(() => {
          setIsScanning(false);
          setShowResults(true);
        }, 1200);
      } else {
        throw new Error(data.error || "AIScan returned an unsuccessful payload.");
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setIsScanning(false);
      setPhotoVerificationError(err.message || "Skin AI Analysis failed. Please try a different photo.");
    }
  };

  useEffect(() => {
    if (messages.length === 0 && !lastStepIdRef.current) {
      setMessages([{
        id: generateId(),
        sender: 'bot',
        text: "Hi there, I'm going to ask you a few questions about your skin and lifestyle, after which we will do a face scan :).",
        timestamp: Date.now(),
        showBack: false
      }]);
      // Only add the first step's message if it hasn't been added yet
      lastStepIdRef.current = currentStep.id;
      setTimeout(() => {
        addBotMessage(currentStep);
      }, 500);
    } else if (lastStepIdRef.current !== currentStep.id) {
      addBotMessage(currentStep);
    }
  }, [currentStep]);

  const addBotMessage = (step: any, scanResults?: any) => {
    lastStepIdRef.current = step.id;
    const botMsg: Message = {
      id: generateId(),
      sender: 'bot',
      text: step.title,
      type: scanResults ? 'scan_results' : (step.id === 'breakoutType' ? 'breakout_options' : (step.options ? 'options' : 'text')),
      options: step.options,
      scanResults: scanResults,
      timestamp: Date.now(),
      showBack: step.id !== 'feel'
    };
    setMessages((prev) => {
        if (step.id === 'feel' && prev.some(m => m.text.includes("Hi there"))) {
            return [prev[0], botMsg];
        }
        return [...prev, botMsg];
    });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, currentStep]);

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedProductSearchQuery(inputText); }, 250);
    return () => clearTimeout(handler);
  }, [inputText]);

  useEffect(() => {
    if (debouncedProductSearchQuery && currentStep.type === 'search_products') {
      const fetchProducts = async () => {
        const { data, error } = await supabase.from('products').select('*').textSearch('fts_search', debouncedProductSearchQuery, { config: 'english', type: 'websearch' }).limit(10);
        if (data) {
          setSearchResults(data);
          setIsDropdownOpen(true);
        }
      };
      fetchProducts();
    } else {
        setSearchResults([]);
        setIsDropdownOpen(false);
    }
  }, [debouncedProductSearchQuery, currentStep.type]);

  const handleOptionClick = (option: string) => {
    // Find the title for the user message
    let displayText = option;
    if (currentStep.id === 'breakoutType') {
      const opt = [...BREAKOUT_PHOTO_OPTIONS, { value: 'dont_know', fullTitle: 'I don\'t know.' }].find(o => o.value === option);
      if (opt) displayText = opt.fullTitle;
    }
    
    if (currentStep.type === 'multiple') {
        const currentList = answers[currentStep.key] || [];
        const newList = currentList.includes(option)
          ? currentList.filter((item: string) => item !== option)
          : [...currentList, option];
        updateAnswer(currentStep.key, newList);
    } else {
        updateAnswer(currentStep.key, option);
        addUserMessage(displayText);
        setTimeout(handleNext, 300);
    }
  };

  const handleTextSubmit = () => {
    if (!inputText.trim()) return;
    addUserMessage(inputText);
    updateAnswer(currentStep.key, inputText);
    setInputText('');
    setTimeout(handleNext, 300);
  };

  if (isScanningFace) {
    if (isCameraActive) {
      return (
        <div 
          className="fixed inset-0 bg-[#FAFAF9] z-[999] flex flex-col items-center justify-start pt-12 p-6 md:p-12 text-black animate-fadeIn"
          id="camera-softbox-viewport"
        >
          <style>{`
            @keyframes scanLine {
              0% { top: 0%; }
              50% { top: 100%; }
              100% { top: 0%; }
            }
          `}</style>
          
          <div className="text-center mb-6 space-y-2">
            <h2 id="camera-scan-title" className="text-xl md:text-3xl font-sans font-black uppercase text-neutral-900 tracking-tight">
              Scan your face
            </h2>
            <p className="text-xs md:text-sm text-neutral-500 font-semibold">
              Live preview. Keep your camera stable.
            </p>
          </div>

          {cameraError ? (
            <div className="w-full max-w-md p-6 bg-red-50 border-2 border-red-500/10 rounded-3xl text-center space-y-4 shadow-sm animate-fadeIn">
              <Info className="w-10 h-10 text-red-500 mx-auto" />
              <p className="text-sm font-bold text-red-600 leading-relaxed">{cameraError}</p>
              
              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => cameraErrorFileInputRef.current?.click()}
                  className="py-3 px-8 bg-neutral-900 text-white hover:bg-neutral-800 active:scale-95 rounded-2xl text-sm font-black uppercase tracking-widest transition-all w-full flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4 text-amber-300" />
                  <span>Upload Photo Instead</span>
                </button>
                
                <input 
                  type="file" 
                  ref={cameraErrorFileInputRef}
                  id="camera-error-file-input" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64Data = reader.result as string;
                      try {
                        const compressed = await compressImage(base64Data);
                        if (cameraTarget === 'closeup') {
                          setCloseUpPhoto(compressed);
                        } else {
                          setFrontPhoto(compressed);
                        }
                      } catch (err) {
                        if (cameraTarget === 'closeup') {
                          setCloseUpPhoto(base64Data);
                        } else {
                          setFrontPhoto(base64Data);
                        }
                      }
                      setIsCameraActive(false);
                      setCameraError(null);
                    };
                    reader.readAsDataURL(file);
                  }}
                />

                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setCameraError(null);
                    setFrontPhoto(null);
                    setCloseUpPhoto(null);
                    setIsScanningFace(false);
                  }}
                  className="py-3 px-8 bg-neutral-100 text-neutral-800 hover:bg-neutral-200 active:scale-95 rounded-2xl text-sm font-black uppercase tracking-widest transition-all w-full"
                >
                  Go Back to Chat
                </button>
              </div>
            </div>
          ) : (
            <div className="relative w-full max-w-sm aspect-[9/21] bg-neutral-100 rounded-[40px] overflow-hidden shadow-2xl border-4 border-neutral-200 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1] rounded-[36px]"
              />

              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6">
                <div className="absolute inset-4 border border-white/20 rounded-3xl">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-300 rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-300 rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-300 rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-300 rounded-br-xl" />
                </div>

                <div 
                  className="absolute left-0 right-0 h-1 bg-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.8)] opacity-95"
                  style={{
                    animation: 'scanLine 3s ease-in-out infinite'
                  }}
                />

                <div className="absolute inset-0 flex items-center justify-center">
                  {cameraTarget === 'front' ? (
                    <svg 
                      viewBox="0 0 225 525" 
                      className="w-full h-full text-amber-300/80 opacity-90 animate-pulse"
                    >
                      <ellipse
                        cx="112.5"
                        cy="262.5"
                        rx="85"
                        ry="189"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                      />
                      <circle cx="112.5" cy="262.5" r="2" fill="currentColor" />
                      <line x1="112.5" y1="10" x2="112.5" y2="25" stroke="currentColor" strokeWidth="2" />
                      <line x1="112.5" y1="500" x2="112.5" y2="515" stroke="currentColor" strokeWidth="2" />
                      <line x1="10" y1="262.5" x2="25" y2="262.5" stroke="currentColor" strokeWidth="2" />
                      <line x1="200" y1="262.5" x2="215" y2="262.5" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  ) : (
                    <svg 
                      viewBox="0 0 300 400" 
                      className="w-full h-full text-amber-300/80 opacity-90 animate-pulse"
                    >
                      <ellipse
                        cx="150"
                        cy="200"
                        rx="75"
                        ry="75"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                      <circle cx="150" cy="200" r="3" fill="currentColor" />
                      <line x1="150" y1="50" x2="150" y2="75" stroke="currentColor" strokeWidth="2" />
                      <line x1="150" y1="325" x2="150" y2="350" stroke="currentColor" strokeWidth="2" />
                      <line x1="30" y1="200" x2="55" y2="200" stroke="currentColor" strokeWidth="2" />
                      <line x1="245" y1="200" x2="270" y2="200" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          )}

          {!cameraError && (
            <p className="text-xs md:text-sm text-neutral-500 font-medium text-center mt-6 max-w-xs leading-relaxed">
              Align your face with the guide. Keep steady for the most accurate scan.
            </p>
          )}

          {!cameraError && (
            <div className="mt-8 flex items-center gap-3 w-full max-w-xs animate-fadeIn">
              <button
                id="capture-frame-btn"
                type="button"
                onClick={capturePhoto}
                className="flex-1 py-3 bg-amber-300 text-neutral-900 border-2 border-transparent hover:bg-amber-400 active:scale-95 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4 text-neutral-950" />
                <span>Capture</span>
              </button>
              
              <button
                id="cancel-camera-btn"
                type="button"
                onClick={stopCamera}
                className="flex-1 py-3 bg-neutral-100 text-neutral-800 hover:bg-neutral-200 active:scale-95 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </div>
          )}
        </div>
      );
    }

    if (showResults) {
      return (
        <div className="flex flex-col h-full bg-neutral-50 overflow-y-auto p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left p-6 bg-white max-w-xl animate-fadeIn w-full mx-auto rounded-3xl shadow-sm border border-neutral-100"
            id="questionnaire-results-container"
          >
            <h2 className="text-xl md:text-2xl font-sans font-black uppercase text-center text-neutral-900 tracking-tight" id="results-headline">
              Your Skin Analysis
            </h2>

            {rednessScore !== null && (
              <div className="border border-neutral-100 rounded-2xl p-4 bg-stone-50/50 space-y-3" id="results-dermal-dashboard">
                <div className="flex flex-col space-y-3">
                  <div className="flex flex-col space-y-1 bg-white p-3 rounded-xl border border-neutral-100">
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase font-black text-neutral-400 tracking-wider">Redness</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black text-red-600 font-sans">{rednessScore}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-red-400 to-red-500 h-full rounded-full transition-all duration-1000" style={{ width: `${rednessScore}%` }} />
                    </div>
                  </div>

                  <div className="flex flex-col space-y-1 bg-white p-3 rounded-xl border border-neutral-100">
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase font-black text-neutral-400 tracking-wider">Wrinkle Density</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black text-violet-600 font-sans">{wrinklesScore}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-violet-400 to-violet-500 h-full rounded-full transition-all duration-1000" style={{ width: `${wrinklesScore}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-neutral-50 border border-neutral-100 p-4 rounded-2xl relative overflow-hidden" id="report-text-card">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />
              <span className="text-[9px] uppercase font-black text-neutral-400 tracking-widest block mb-1">Diagnostic Summary report</span>
              <p className="text-xs md:text-sm font-semibold text-neutral-600 tracking-normal italic leading-relaxed">
                "{generateSkinReportText(mapAnswersToProfile(answers))}"
              </p>
            </div>

            <button
              onClick={() => {
                if (onComplete) {
                  onComplete(answers);
                }
              }}
              className="w-full bg-amber-300 hover:bg-amber-400 text-neutral-900 rounded-full py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center mt-4 transition-all"
              id="questionnaire-complete-btn"
            >
              Sign up to find out more
            </button>
          </motion.div>
        </div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col h-full bg-neutral-50 max-w-xl mx-auto text-neutral-800 tracking-normal w-full p-6 overflow-y-auto"
        id="face-scan-container"
      >
        <h2 className="text-xl md:text-2xl font-sans font-black uppercase text-center text-neutral-900 mb-1 tracking-tight">
          Let's see your face
        </h2>
        <p className="text-xs md:text-sm text-neutral-500 font-semibold mb-6 text-center">
          Take or upload photos of your skin for more accurate insights.
        </p>

        {isScanning ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-6 flex-1" id="scanning-loader">
            <div className="relative w-40 h-40 rounded-3xl overflow-hidden border border-neutral-200 bg-white shadow-sm flex items-center justify-center">
              {frontPhoto ? (
                <img src={frontPhoto} alt="Front face scan" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-10 h-10 text-neutral-300 animate-pulse" />
              )}
              <div 
                className="absolute left-0 w-full h-1 bg-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.8)] animate-bounce" 
                style={{ animationDuration: '2s' }}
              />
            </div>

            <div className="w-full max-w-xs space-y-2 text-center">
              <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-neutral-500">
                <span>{scanStepName}</span>
                <span>{scanProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-300 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-neutral-400 font-semibold uppercase tracking-widest text-center animate-pulse">
              Dermal scanning in progress...
            </p>
          </div>
        ) : (
          <div className="space-y-6 flex-1 min-h-0 overflow-y-auto pr-1" id="capturing-uploads-phase">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col space-y-2">
                <span className="text-xs uppercase font-black tracking-widest text-neutral-500 flex items-center">
                  1. Front-Facing Photo
                </span>
                <p className="text-[11px] font-semibold text-neutral-400 leading-normal">
                  Capture in well-lit natural light facing the lens directly.
                </p>

                {frontPhoto ? (
                  <div className="border border-neutral-200 rounded-2xl aspect-square relative overflow-hidden bg-white shadow-sm">
                    <img src={frontPhoto} alt="Front Facing selfie" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                      <button 
                        type="button"
                        onClick={() => setFrontPhoto(null)}
                        className="bg-white text-neutral-900 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-neutral-50 active:scale-95 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Retake</span>
                      </button>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFrontPhoto(null); }}
                      className="absolute top-2 right-2 bg-neutral-900/60 text-white rounded-full p-1 hover:bg-neutral-900 transition-all active:scale-90"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="border border-dashed border-neutral-300 rounded-2xl p-6 flex flex-col items-center justify-center aspect-square bg-white text-center shadow-sm">
                    <div className="space-y-3 flex flex-col items-center w-full max-w-[200px]">
                      <div className="p-2.5 bg-amber-50 rounded-full text-amber-500">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-black uppercase tracking-wide text-neutral-800">Dermal Selfie</h4>
                        <p className="text-[10px] text-neutral-400 font-semibold leading-normal">
                          Ready to scan your skin using the front selfie camera?
                        </p>
                      </div>
                      
                      <button
                        id="ready-camera-btn"
                        type="button"
                        onClick={() => startCamera('front')}
                        className="w-full py-2 bg-amber-300 hover:bg-amber-400 text-neutral-900 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <span>Start Camera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => frontFileInputRef.current?.click()}
                        className="text-[10px] text-neutral-400 hover:text-neutral-600 font-semibold uppercase tracking-wider cursor-pointer underline mt-0.5"
                      >
                        Upload file instead
                      </button>

                      <input 
                        type="file" 
                        ref={frontFileInputRef}
                        id="front-file-input" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={(e) => handlePhotoUpload(e, true)}
                      />
                    </div>
                  </div>
                )}

                {photoVerificationError && (
                  <div className="text-[10px] text-red-600 font-bold bg-red-50 p-2 rounded-xl border border-red-100 flex items-start gap-1 mt-1 animate-fadeIn text-left max-w-full leading-normal">
                    <Info className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                    <span>{photoVerificationError}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col space-y-2">
                <span className="text-xs uppercase font-black tracking-widest text-neutral-500 flex items-center">
                  2. Close-Up Photo
                </span>
                <p className="text-[11px] font-semibold text-neutral-400 leading-normal">
                  Zoom in on specific concern areas (spots or redness). Optional.
                </p>

                {closeUpPhoto ? (
                  <div className="border border-neutral-200 rounded-2xl aspect-square relative overflow-hidden bg-white shadow-sm">
                    <img src={closeUpPhoto} alt="Close Up selfie" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                      <button 
                        type="button"
                        onClick={() => setCloseUpPhoto(null)}
                        className="bg-white text-neutral-900 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-neutral-50 active:scale-95 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Retake</span>
                      </button>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setCloseUpPhoto(null); }}
                      className="absolute top-2 right-2 bg-neutral-900/60 text-white rounded-full p-1 hover:bg-neutral-900 transition-all active:scale-90"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="border border-dashed border-neutral-300 rounded-2xl p-6 flex flex-col items-center justify-center aspect-square bg-white text-center shadow-sm">
                    <div className="space-y-3 flex flex-col items-center w-full max-w-[200px]">
                      <div className="p-2.5 bg-amber-50 rounded-full text-amber-500">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-black uppercase tracking-wide text-neutral-800">Close-up / Spot Scan</h4>
                        <p className="text-[10px] text-neutral-400 font-semibold leading-normal">
                          Ready to scan your target area with the live camera?
                        </p>
                      </div>
                      
                      <button
                        id="ready-closeup-camera-btn"
                        type="button"
                        onClick={() => startCamera('closeup')}
                        className="w-full py-2 bg-amber-300 hover:bg-amber-400 text-neutral-900 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <span>Start Camera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => closeupFileInputRef.current?.click()}
                        className="text-[10px] text-neutral-400 hover:text-neutral-600 font-semibold uppercase tracking-wider cursor-pointer underline mt-0.5"
                      >
                        Upload file instead
                      </button>

                      <input 
                        type="file" 
                        ref={closeupFileInputRef}
                        id="closeup-file-input" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={(e) => handlePhotoUpload(e, false)}
                      />
                    </div>
                  </div>
                )}
                {!closeUpPhoto && frontPhoto && (
                  <button 
                    onClick={() => loadDemoPhoto(false)} 
                    className="text-[10px] font-black uppercase tracking-wider text-neutral-400 hover:text-neutral-600 transition-all text-center mt-1.5"
                  >
                    💡 Use Demo Close-up
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-neutral-100 pt-6 mt-6">
              <button
                onClick={() => setIsScanningFace(false)}
                className="text-neutral-400 hover:text-neutral-600 font-semibold text-xs flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to questions
              </button>

              <button
                onClick={() => startDermalScan()}
                disabled={!frontPhoto}
                className="px-4 py-2 bg-amber-300 disabled:opacity-40 hover:bg-amber-400 text-neutral-900 rounded-full text-xs font-bold flex items-center gap-1 transition-all"
              >
                Analyze Face
              </button>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-neutral-50">
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`${msg.type === 'breakout_options' ? 'w-full' : 'w-11/12'} p-3 rounded-2xl text-[15px] md:text-lg ${
                msg.sender === 'bot'
                  ? 'bg-white border border-neutral-200 text-neutral-800 rounded-bl-none'
                  : 'bg-amber-100 text-neutral-900 rounded-br-none'
              }`}
            >
              {msg.text}
              {msg.type === 'scan_results' && msg.scanResults && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-emerald-100 shadow-sm text-neutral-800">
                    <p className="font-semibold text-xs mb-2">Dermal Scan Report</p>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <p>Redness: <span className="font-medium text-emerald-600">{msg.scanResults.redness_score}/10</span></p>
                        <p>Wrinkles: <span className="font-medium text-emerald-600">{msg.scanResults.wrinkles_score}/10</span></p>
                        <p className="col-span-2">Acne type: <span className="font-medium text-emerald-600">{msg.scanResults.scan_acne_type}</span></p>
                    </div>
                </div>
              )}
              {msg.type === 'breakout_options' && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                    {[...BREAKOUT_PHOTO_OPTIONS, { value: 'dont_know', fullTitle: 'I don\'t know.', img: '' }].map((opt: any) => (
                        <button
                          key={opt.value}
                          onClick={() => handleOptionClick(opt.value)}
                          className="flex flex-col items-center gap-1.5 p-2 bg-white rounded-lg shadow-sm border border-neutral-200 hover:border-amber-300 transition-colors"
                        >
                          <div className="w-full h-20 bg-neutral-100 rounded-md overflow-hidden flex items-center justify-center">
                            {opt.img ? (
                              <img src={opt.img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="text-neutral-400 text-xs italic">N/A</div>
                            )}
                          </div>
                          <span className="text-[12px] md:text-[14px] text-center text-neutral-800 font-medium leading-tight">{opt.fullTitle}</span>
                        </button>
                    ))}
                </div>
              )}
              {msg.sender === 'bot' && msg.showBack && (
                  <button onClick={handleBack} className="block mt-1 text-neutral-400 hover:text-neutral-700">
                      <ArrowLeft className="w-3 h-3" />
                  </button>
              )}
            </div>
          </motion.div>
        ))}
        {/* Removed Face Scan button */}
      </div>
        
      <div className="p-4 pt-0">
        {(currentStep.type === 'single' || currentStep.type === 'multiple') && currentStep.options && currentStep.id !== 'breakoutType' && (
          <div className="flex flex-wrap gap-2">
            {currentStep.options.filter((opt: string) => !(currentStep.id === 'scndConcern' && opt === answers.mainConcern)).map((opt: any) => (
               <button
                 key={opt}
                 onClick={() => handleOptionClick(opt)}
                 className={`px-4 py-2 rounded-full text-[15px] md:text-lg font-medium transition-colors ${
                     (currentStep.type === 'multiple' && answers[currentStep.key]?.includes(opt)) || (currentStep.type === 'single' && answers[currentStep.key] === opt)
                     ? 'bg-amber-300 text-neutral-900'
                     : 'bg-white border border-neutral-300 text-neutral-800 hover:bg-neutral-100'
                 }`}
               >
                 {opt}
               </button>
            ))}
            {currentStep.type === 'multiple' && (
                <button onClick={() => {
                    const ans = answers[currentStep.key] || [];
                    addUserMessage(ans.length > 0 ? ans.join(", ") : "None / Skip");
                    handleNext();
                }} className="bg-neutral-800 text-white px-4 py-2 rounded-full text-[15px] md:text-lg font-medium hover:bg-neutral-900 transition-colors">
                    Submit
                </button>
            )}
          </div>
        )}
      </div>

      {['text', 'age'].includes(currentStep.type) && (
        <div className="p-4 pt-0 flex flex-col gap-2">
            <div className="flex gap-2">
                <input 
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type your answer..."
                    className="flex-1 p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-emerald-500 text-[15px] md:text-lg"
                    onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                />
                <button onClick={handleTextSubmit} className="bg-amber-300 text-neutral-900 p-3 rounded-xl">
                    <Send className="w-5 h-5" />
                </button>
            </div>
            {currentStep.id === 'pastProblems' && (
                <button onClick={() => {
                    addUserMessage("Skip");
                    handleNext();
                }} className="text-neutral-500 hover:text-neutral-700 text-[15px] md:text-lg py-2 font-medium">
                    Skip
                </button>
            )}
        </div>
      )}

      {currentStep.type === 'search_products' && (
        <div className="p-4 pt-0 relative">
          {(answers[currentStep.key] || []).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {(answers[currentStep.key] || []).map((p: string, i: number) => (
                <div key={i} className="flex items-center gap-1 bg-emerald-100 px-3 py-1.5 rounded-full text-[15px] md:text-lg">
                  <span>{p}</span>
                  <button onClick={() => updateAnswer(currentStep.key, (answers[currentStep.key] || []).filter((_: any, index: number) => index !== i))}>X</button>
                </div>
              ))}
            </div>
          )}
          {isDropdownOpen && searchResults.length > 0 && (
            <div className="absolute bottom-full mb-2 left-4 right-4 bg-white border border-neutral-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
              {searchResults.map((product) => (
                <button
                  key={product.id}
                  onClick={() => {
                    const currentList = answers[currentStep.key] || [];
                    updateAnswer(currentStep.key, [...currentList, `${product.brand} - ${product.name}`]);
                    setInputText('');
                    setIsDropdownOpen(false);
                  }}
                  className="block w-full text-left p-3 hover:bg-neutral-100 text-[15px] md:text-lg"
                >
                  {product.brand} - {product.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Search products..."
                className="flex-1 p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-emerald-500 text-[15px] md:text-lg"
              />
              <button onClick={() => {
                  const ans = answers[currentStep.key] || [];
                  addUserMessage(ans.length > 0 ? ans.join(", ") : "Skip");
                  handleNext();
              }} className="bg-amber-300 text-neutral-900 px-4 py-2 rounded-xl text-[15px] md:text-lg font-medium">
                Done
              </button>
            </div>
            {currentStep.id === 'currentProducts' && (
                <button onClick={() => {
                    addUserMessage("Skip");
                    handleNext();
                }} className="text-neutral-500 hover:text-neutral-700 text-[15px] md:text-lg py-2 font-medium w-full text-center">
                    Skip
                </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

