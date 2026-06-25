import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, Search, Plus, Camera, Upload, X, Sparkles, Info, Check, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { mapAnswersToProfile, generateSkinReportText } from '../skin_report';

interface Step {
  id: string;
  title: string;
  type: 'single' | 'multiple' | 'age' | 'tone' | 'text' | 'search_products';
  key: string;
  options?: string[];
  condition?: (answers: any) => boolean;
  part: number;
}

const BREAKOUT_PHOTO_OPTIONS = [
  {
    value: 'whiteheads',
    title: 'Blocked pores on the surface of the skin, white head',
    desc: 'Blocked pores on the surface of the skin, white head',
    img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/Whiteheads2.png'
  },
  {
    value: 'blackheads',
    title: 'Blocked pores on the surface of the skin, black head',
    desc: 'Blocked pores on the surface of the skin, black head',
    img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/Blackheads.webp'
  },
  {
    value: 'pie',
    title: 'Pink/red marks left after acne heals',
    desc: 'Pink/red marks left after acne heals',
    img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/PIE.png'
  },
  {
    value: 'pih',
    title: 'Dark marks left after acne heals',
    desc: 'Dark marks left after acne heals',
    img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/PIH.png'
  },
  {
    value: 'papules',
    title: 'Small, tender red bumps without pus',
    desc: 'Small, tender red bumps without pus',
    img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/Papules.png'
  },
  {
    value: 'conglo',
    title: 'Interconnected clusters of deep, painful acne',
    desc: 'Interconnected clusters of deep, painful acne',
    img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/Conglobate.png'
  },
  {
    value: 'pustules',
    title: 'Red bumps with a visible white head',
    desc: 'Red bumps with a visible white head',
    img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/Pustules2.png'
  },
  {
    value: 'nodules',
    title: 'Large, hard, painful lumps deep under skin',
    desc: 'Large, hard, painful lumps deep under skin',
    img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/Nodules.png'
  },
  {
    value: 'cystic',
    title: 'Large, soft, liquid-filled lumps deep under the skin',
    desc: 'Large, soft, liquid-filled lumps deep under the skin',
    img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/Cystic.png'
  },
  {
    value: 'none',
    title: 'None of these',
    desc: 'None of these',
    img: null
  }
];

const ALL_STEPS: Step[] = [
  {
    id: 'feel',
    title: "You just washed your face in the morning, how does your skin feel?",
    type: 'single',
    key: 'feel',
    options: ['Dry and tight', 'Oily all over', 'Oily forehead and nose, but dry cheeks'],
    part: 1
  },
  {
    id: 'sun',
    title: "How does your skin react to the sun?",
    type: 'single',
    key: 'sun',
    options: ["I burn like a lobster", 'Burn then tan', 'Got no problems tanning'],
    part: 1
  },
  {
    id: 'sensitivity',
    title: "Does your skin frequently experience any of the following? (Select all that apply)",
    type: 'multiple',
    key: 'sensitivity',
    options: ['Burning or stinging from products', 'Redness', 'Itching', 'Flaking or peeling', 'Tightness even after moisturizing'],
    part: 2
  },
  {
    id: 'reaction',
    title: "How does your skin react to new skincare products?",
    type: 'single',
    key: 'reaction',
    options: ['Very good, no problems', 'Sometimes sensitive', 'Often get redness, bumps, or burning', 'Almost everything irritates my skin'],
    part: 2
  },
  {
    id: 'goals',
    title: "What's your main skin goal?",
    type: 'single',
    key: 'goals',
    options: ['Clear breakouts', 'Control oiliness', 'Reduce blackheads and clogged pores', 'Deeply hydrate', 'Smooth texture', 'Glow from within', 'Brighten dark spots', 'Soften fine lines and wrinkles', 'Calm redness'],
    part: 3
  },
  {
    id: 'breakoutType',
    title: "What type of breakouts do you get?",
    type: 'multiple',
    key: 'breakoutType',
    options: ['whiteheads', 'blackheads', 'pie', 'pih', 'papules', 'conglo', 'pustules', 'nodules', 'cystic', 'none'],
    condition: (ans) => ans.goals?.includes('Clear breakouts'),
    part: 3
  },
  {
    id: 'breakoutWhere',
    title: "Where do you break out?",
    type: 'single',
    key: 'breakoutWhere',
    options: ['Forehead', 'Nose', 'Chin/jawline', 'Cheeks', 'Chest/back'],
    condition: (ans) => ans.goals?.includes('Clear breakouts'),
    part: 3
  },
  {
    id: 'env',
    title: "What's your environment like?",
    type: 'single',
    key: 'env',
    options: ['Hot & humid', 'Hot & dry', 'Cold & dry', 'Mild'],
    part: 4
  },
  {
    id: 'sunscreen',
    title: "How often do you use sunscreen?",
    type: 'single',
    key: 'sunscreen',
    options: ['Every day', 'Sometimes', 'Never'],
    part: 4
  },
  {
    id: 'makeup',
    title: "How about makeup?",
    type: 'single',
    key: 'makeup',
    options: ['Every day', 'Sometimes', 'Never'],
    part: 4
  },
  {
    id: 'activesUsed',
    title: "Are you currently using any of the following? Select all that apply",
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
    title: "What products are you using currently?",
    type: 'search_products',
    key: 'currentProducts',
    part: 4
  },
  {
    id: 'pastProblems',
    title: "Are there any ingredients you've had issues with / you'd like to avoid? (optional)",
    type: 'text',
    key: 'pastProblems',
    part: 4
  },
  {
    id: 'age',
    title: "What's your age?",
    type: 'age',
    key: 'age',
    part: 6
  },
  {
    id: 'skinTone',
    title: "What's the tone of your skin?",
    type: 'tone',
    key: 'skinTone',
    condition: () => false,
    part: 6
  }
];

const getSkinToneColor = (value: number) => {
  if (value <= 50) {
    const t = value / 50;
    const r = Math.round(246 + t * (209 - 246));
    const g = Math.round(237 + t * (166 - 237));
    const b = Math.round(228 + t * (137 - 228));
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const t = (value - 50) / 50;
    const r = Math.round(209 + t * (61 - 209));
    const g = Math.round(166 + t * (43 - 166));
    const b = Math.round(137 + t * (31 - 137));
    return `rgb(${r}, ${g}, ${b})`;
  }
};

export const Questionnaire = ({ onComplete }: { onComplete: (answers: any) => void }) => {
  const [answers, setAnswers] = useState<any>({
    goals: [],
    sensitivity: [],
    currentProducts: [],
    breakoutType: [],
    activesUsed: []
  });
  const [stepIndex, setStepIndex] = useState(0);
  const trackRef = React.useRef<HTMLDivElement>(null);

  const calculateAndSetVal = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const offsetY = clientY - rect.top;
    let percentage = (offsetY / rect.height) * 100;
    percentage = Math.max(0, Math.min(100, percentage));
    updateAnswer('skinTone', Math.round(percentage));
  };
  const [viewMode, setViewMode] = useState<'form' | 'face_scan' | 'confirm_scan' | 'results'>('form');

  // Scanner Phase States
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [closeUpPhoto, setCloseUpPhoto] = useState<string | null>(null);
  const [cameraTarget, setCameraTarget] = useState<'front' | 'closeup'>('front');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStepName, setScanStepName] = useState('');
  const [scanProgress, setScanProgress] = useState(0);

  // Scanner AI check and loading states
  const [photoVerificationError, setPhotoVerificationError] = useState<string | null>(null);

  // Live Camera and Softbox States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const activeStreamRef = React.useRef<MediaStream | null>(null);

  // Sync active stream with ref for cleanup
  useEffect(() => {
    activeStreamRef.current = cameraStream;
  }, [cameraStream]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const sendToGemini = async (base64Image: string) => {
    console.log("sendToGemini placeholder called. Length:", base64Image.length);
    // Placeholder function where this image payload can be sent to hit the Gemini API via Google AI Studio.
    // In production, this can forward to '/api/analyze-face' or your custom edge function.
    try {
      /*
      const response = await fetch("/api/analyze-face-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image })
      });
      return await response.json();
      */
    } catch (e) {
      console.error("Placeholder sendToGemini execution failed:", e);
    }
  };

  const startCamera = async (target: 'front' | 'closeup' = 'front') => {
    setCameraError(null);
    setCameraTarget(target);
    setIsCameraActive(true);
    // Let's allow state to render, then open getUserMedia
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 640 }
          },
          audio: false
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Error accessing camera:", err);
        let errorMsg = "Could not access camera.";
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          errorMsg = "Camera permission was denied. Please allow camera access in your browser settings to scan your face.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          errorMsg = "No front-facing camera was found on this device.";
        }
        setCameraError(errorMsg);
        setIsCameraActive(false);
      }
    }, 100);
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 640;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Mirror the image horizontally for natural selfie style
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, width, height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        const base64Image = canvas.toDataURL("image/jpeg", 0.95);
        if (cameraTarget === 'front') {
          setFrontPhoto(base64Image);
        } else {
          setCloseUpPhoto(base64Image);
        }
        
        // Trigger the Google AI Studio payload placeholder function
        await sendToGemini(base64Image);
      }
      stopCamera();
    } catch (e) {
      console.error("Error capturing photo frame:", e);
    }
  };

  // Scan metrics state
  const [rednessScore, setRednessScore] = useState(10);
  const [wrinklesScore, setWrinklesScore] = useState(10);
  const [rednessMainArea, setRednessMainArea] = useState('Cheeks');
  const [wrinklesMainArea, setWrinklesMainArea] = useState('None');
  const [scanAcneType, setScanAcneType] = useState('None');

  const runDermalScanComputation = () => {
    // Determine redness_score (0-100)
    let calcRedness = 0;
    const sensitivityList = answers.sensitivity || [];
    if (sensitivityList.includes('Redness')) calcRedness += 45;
    
    // Check main big goal
    const goals = answers.goals || [];
    const hasCalmRedness = Array.isArray(goals) 
      ? goals.includes('Calm redness') 
      : goals === 'Calm redness';
    if (hasCalmRedness) calcRedness += 20;

    if (answers.reaction === 'Often get redness, bumps, or burning') calcRedness += 25;
    else if (answers.reaction === 'Almost everything irritates my skin') calcRedness += 35;
    
    // Default fallback base
    if (calcRedness === 0) calcRedness = 12;
    calcRedness = Math.min(100, Math.max(0, calcRedness));

    // Determine wrinkles_score (0-100) based on age group
    const userAge = parseInt(answers.age) || 25;
    let calcWrinkles = 0;
    if (userAge < 25) {
      calcWrinkles = Math.round(userAge * 0.4);
    } else if (userAge >= 25 && userAge < 35) {
      calcWrinkles = Math.round((userAge - 25) * 1.5 + 10);
    } else if (userAge >= 35 && userAge < 45) {
      calcWrinkles = Math.round((userAge - 35) * 2.0 + 25);
    } else if (userAge >= 45 && userAge < 60) {
      calcWrinkles = Math.round((userAge - 45) * 1.6 + 45);
    } else {
      calcWrinkles = Math.round((userAge - 60) * 0.8 + 70);
    }
    // If goal is soften lines
    const hasSoftenWrinkles = Array.isArray(goals)
      ? goals.includes('Soften fine lines and wrinkles')
      : goals === 'Soften fine lines and wrinkles';
    if (hasSoftenWrinkles) {
      calcWrinkles += 15;
    }
    calcWrinkles = Math.min(100, Math.max(0, calcWrinkles));

    // Determine redness_main_area defaults
    let calcRedArea = 'Cheeks';
    if (answers.breakoutWhere === 'Nose') calcRedArea = 'T-zone';
    else if (answers.breakoutWhere === 'Forehead') calcRedArea = 'Forehead';
    else if (answers.breakoutWhere === 'Chin/jawline') calcRedArea = 'Chin';
    else if (sensitivityList.includes('Redness') && answers.feel === 'Oily all over') calcRedArea = 'T-zone';
    else if (!sensitivityList.includes('Redness') && answers.feel === 'Comfortable') calcRedArea = 'None';

    // Determine wrinkles_main_area defaults
    let calcWrinkArea = 'None';
    if (userAge >= 60) calcWrinkArea = 'Forehead';
    else if (userAge >= 45) calcWrinkArea = 'Periorbital';
    else if (userAge >= 30) calcWrinkArea = 'Nasolabial';

    // Determine acne_type defaults (from standard options)
    let calcAcneType = 'None';
    const hasBreakoutGoal = Array.isArray(goals)
      ? goals.includes('Clear breakouts')
      : goals === 'Clear breakouts';
    if (hasBreakoutGoal || (answers.breakoutType && answers.breakoutType.length > 0)) {
      const bTypes = answers.breakoutType || [];
      if (bTypes.includes('cystic')) {
        calcAcneType = 'Cystic Acne';
      } else if (bTypes.includes('nodules')) {
        calcAcneType = 'Nodules';
      } else if (bTypes.includes('pustules')) {
        calcAcneType = 'Pustules';
      } else if (bTypes.includes('conglo')) {
        calcAcneType = 'Cluster of red bumps (Conglobate / Acne Rash)';
      } else if (bTypes.includes('papules')) {
        calcAcneType = 'Papules';
      } else if (bTypes.includes('pih')) {
        calcAcneType = 'Post-Inflammatory Hyperpigmentation';
      } else if (bTypes.includes('pie')) {
        calcAcneType = 'Post-Inflammatory Erythema';
      } else if (bTypes.includes('whiteheads')) {
        calcAcneType = 'Closed Comedones';
      } else if (bTypes.includes('blackheads')) {
        calcAcneType = 'Open Comedones';
      } else {
        calcAcneType = 'None';
      }
    }

    setRednessScore(calcRedness);
    setWrinklesScore(calcWrinkles);
    setRednessMainArea(calcRedArea);
    setWrinklesMainArea(calcWrinkArea);
    setScanAcneType(calcAcneType);
  };

  // States for products search
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [isAddingNewProduct, setIsAddingNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ brand: '', name: '', type: '' });

  // Debounce search query
  const [debouncedProductSearchQuery, setDebouncedProductSearchQuery] = useState('');
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedProductSearchQuery(productSearchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [productSearchQuery]);

  useEffect(() => {
    if (!debouncedProductSearchQuery.trim()) {
      setProductSearchResults([]);
      setIsSearchingProducts(false);
      return;
    }
    const performSearch = async () => {
      setIsSearchingProducts(true);
      try {
        const formattedQuery = debouncedProductSearchQuery
          .trim()
          .split(/\s+/)
          .filter(word => word.length > 0)
          .map(word => `${word}:*`)
          .join(' & ');

        const { data, error } = await supabase
          .from('products')
          .select('*')
          .textSearch('fts_search', formattedQuery, {
            config: 'english'
          })
          .limit(10);

        if (error) throw error;
        setProductSearchResults(data || []);
      } catch (err) {
        console.error('Questionnaire product search error:', err);
      } finally {
        setIsSearchingProducts(false);
      }
    };
    performSearch();
  }, [debouncedProductSearchQuery]);

  // Disable body and outer frame scrolling on mobile devices during questionnaire to guarantee locked view matching responsive expectations
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyPosition = document.body.style.position;
    
    const handleResize = () => {
      if (window.innerWidth < 768) {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100dvw';
        document.body.style.height = '100dvh';
      } else {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.width = '';
      document.body.style.height = '';
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Compute active steps dynamically based on current answers
  const activeSteps = ALL_STEPS.filter(
    (step) => !step.condition || step.condition(answers)
  );

  const currentStep = activeSteps[stepIndex] || activeSteps[activeSteps.length - 1];

  const handleNext = () => {
    if (stepIndex < activeSteps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      runDermalScanComputation();
      setViewMode('face_scan');
    }
  };

  const handleBack = () => {
    if (viewMode === 'face_scan') {
      setViewMode('form');
      setStepIndex(activeSteps.length - 1);
    } else if (viewMode === 'confirm_scan') {
      setViewMode('face_scan');
    } else if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };

  const updateAnswer = (key: string, value: any) => {
    if (key === 'goals') {
      setAnswers((prev: any) => ({ ...prev, [key]: [value] }));
    } else {
      setAnswers((prev: any) => ({ ...prev, [key]: value }));
    }
  };

  const toggleArrayAnswer = (key: string, value: string) => {
    setAnswers((prev: any) => {
      let currentList = prev[key] || [];
      if (key === 'activesUsed') {
        if (value === "None/ I'm not sure") {
          currentList = prev[key].includes(value) ? [] : [value];
        } else {
          currentList = prev[key].filter((item: string) => item !== "None/ I'm not sure");
          currentList = currentList.includes(value)
            ? currentList.filter((item: string) => item !== value)
            : [...currentList, value];
        }
      } else {
        currentList = currentList.includes(value)
          ? currentList.filter((item: string) => item !== value)
          : [...currentList, value];
      }
      return { ...prev, [key]: currentList };
    });
  };

  const addProductToCurrent = (p: any) => {
    const currentList = answers.currentProducts || [];
    if (!currentList.some((existing: any) => 
      (existing.id && existing.id === p.id) || 
      (existing.name === p.name && existing.brand === p.brand)
    )) {
      updateAnswer('currentProducts', [...currentList, p]);
    }
  };

  const removeProductFromCurrent = (p: any) => {
    const currentList = answers.currentProducts || [];
    const updated = currentList.filter((item: any) => {
      if (item.id && p.id) return item.id !== p.id;
      return !(item.name === p.name && item.brand === p.brand);
    });
    updateAnswer('currentProducts', updated);
  };

  const addCustomProduct = () => {
    if (newProduct.brand.trim() && newProduct.name.trim()) {
      const customItem = {
        ...newProduct,
        tempId: Date.now()
      };
      addProductToCurrent(customItem);
      setNewProduct({ brand: '', name: '', type: '' });
      setIsAddingNewProduct(false);
    }
  };

  const titles = {
    1: "Your skin basics",
    2: "Sensitivity & Skin History",
    3: "Your main goals",
    4: "Lifestyle & Current Routine",
    5: "Let's see your face",
    6: "Some final details"
  };

  if (viewMode === 'results') return <Results answers={answers} onComplete={onComplete} />;

  const currentPart = currentStep ? currentStep.part : 1;
  const showNextButton = currentStep ? (currentStep.type !== 'single') : true;

  const renderStepContent = () => {
    if (!currentStep) return null;

    const isLargeButtons = ['feel', 'sun', 'env', 'sunscreen', 'makeup', 'breakoutWhere', 'reaction'].includes(currentStep.id);
    const isCompactButtons = ['goals', 'breakoutType'].includes(currentStep.id);

    const buttonSizeClass = currentStep.id === 'sensitivity'
      ? 'py-3 px-5 sm:py-4 sm:px-6 md:py-5.5 md:px-8 text-sm sm:text-lg md:text-xl min-h-[44px] sm:min-h-[52px] md:min-h-[62px] rounded-lg sm:rounded-xl md:rounded-2xl flex items-center justify-center'
      : isLargeButtons
      ? 'py-4 px-6 md:py-5 md:px-8 text-base md:text-lg min-h-[52px] md:min-h-[58px] rounded-xl md:rounded-2xl'
      : isCompactButtons
      ? 'py-1.5 px-3 md:py-2 md:px-4 text-xs md:text-sm min-h-[32px] md:min-h-[38px] rounded-lg md:rounded-xl'
      : 'py-2.5 px-4 md:py-3.5 md:px-6 text-sm md:text-base min-h-[42px] md:min-h-[48px] rounded-xl md:rounded-2xl';

    const containerSpacingClass = currentStep.id === 'reaction'
      ? 'space-y-4 md:space-y-5'
      : currentStep.id === 'sensitivity'
      ? 'space-y-1.5 sm:space-y-2 md:space-y-3'
      : isCompactButtons
      ? 'space-y-1.5 md:space-y-2'
      : 'space-y-2 md:space-y-3';

    switch (currentStep.type) {
      case 'single':
        return (
          <div className="flex flex-col items-center text-center w-full max-h-full" id={`step-container-${currentStep.id}`}>
            <label className="text-lg md:text-2xl font-bold block mb-4 md:mb-6 text-black px-4 text-center leading-snug w-full" id={`label-question-${currentStep.id}`}>
              {currentStep.title}
            </label>
            <div className={`${containerSpacingClass} px-4 w-full max-w-md overflow-hidden no-scrollbar`}>
              {(currentStep.options || []).map((opt: string, idx: number) => {
                const isSelected = answers[currentStep.key] === opt || (Array.isArray(answers[currentStep.key]) && answers[currentStep.key].includes(opt));
                return (
                  <button
                    key={opt}
                    id={`choice-${currentStep.id}-${idx}`}
                    onClick={() => {
                      updateAnswer(currentStep.key, opt);
                      // Auto-advance after selection
                      setTimeout(() => {
                        if (stepIndex < activeSteps.length - 1) {
                          setStepIndex(stepIndex + 1);
                        } else {
                          runDermalScanComputation();
                          setViewMode('face_scan');
                        }
                      }, 180);
                    }}
                    className={`block w-full text-center font-bold border cursor-pointer transition-all active:scale-[0.98] ${buttonSizeClass} ${
                      isSelected
                        ? 'border-black bg-black text-white shadow-md'
                        : 'border-black/10 bg-white text-black hover:border-black/30 hover:bg-black/[0.01]'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'multiple':
        if (currentStep.id === 'breakoutType') {
          const toggleBreakout = (val: string) => {
            setAnswers((prev: any) => {
              let currentList = prev.breakoutType || [];
              if (val === 'none') {
                currentList = currentList.includes('none') ? [] : ['none'];
              } else {
                currentList = currentList.filter((item: string) => item !== 'none');
                currentList = currentList.includes(val)
                  ? currentList.filter((item: string) => item !== val)
                  : [...currentList, val];
              }
              return { ...prev, breakoutType: currentList };
            });
          };

          return (
            <div className="flex flex-col items-center text-center w-full max-h-full pt-3 md:pt-0" id={`step-container-${currentStep.id}`}>
              <label className="text-xl md:text-2xl font-bold block mb-2 text-black px-4 text-center leading-snug w-full animate-fadeIn" id={`label-question-${currentStep.id}`}>
                {currentStep.title}
              </label>
              <p className="text-xs md:text-sm font-semibold text-black/60 mb-5 px-4 max-w-md text-center leading-relaxed animate-fadeIn">
                Choose the picture that looks most similar. If not sure, you can upload a picture later.
              </p>
              
              <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full max-w-lg px-4 pb-6 overflow-y-auto no-scrollbar" style={{ contentVisibility: 'auto' }}>
                {BREAKOUT_PHOTO_OPTIONS.map((opt) => {
                  const isSelected = answers.breakoutType?.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      id={`breakout-choice-${opt.value}`}
                      onClick={() => toggleBreakout(opt.value)}
                      className={`relative aspect-square flex flex-col justify-between border-2 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer text-left bg-white select-none ${
                        isSelected
                          ? 'border-black ring-1 ring-black shadow-md'
                          : 'border-black/10 hover:border-black/30'
                      }`}
                    >
                      {opt.img ? (
                        <>
                          <div className="w-full h-[65%] overflow-hidden relative bg-neutral-100">
                            <img 
                              src={opt.img} 
                              alt={opt.title} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="w-full h-[35%] bg-white px-2 py-1.5 sm:px-3 flex items-center justify-center border-t border-black/5">
                            <span className="text-[10px] sm:text-[11px] leading-tight font-semibold text-black/80 text-center line-clamp-3">
                              {opt.desc}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full bg-neutral-50 flex items-center justify-center p-4">
                          <span className="text-xs sm:text-sm font-bold text-black/70 text-center leading-snug">
                            {opt.desc}
                          </span>
                        </div>
                      )}
                      
                      {/* Selection Indicator (checkmark badge) */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-black text-white rounded-full p-1 shadow-md z-10 animate-scaleIn">
                          <svg className="w-3 h-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        return (
          <div className="flex flex-col items-center text-center w-full max-h-full" id={`step-container-${currentStep.id}`}>
            <label className={`font-bold block text-black px-4 text-center leading-snug w-full ${
              currentStep.id === 'sensitivity' 
                ? 'text-[17px] sm:text-[22px] md:text-3xl mb-3 sm:mb-5 md:mb-7 mt-1' 
                : 'text-lg md:text-2xl mb-4 md:mb-6'
            }`} id={`label-question-${currentStep.id}`}>
              {currentStep.title}
            </label>
            <div className={`${containerSpacingClass} w-full max-w-md px-4 overflow-hidden no-scrollbar`}>
              {(currentStep.options || []).map((opt: string, idx: number) => {
                const isSelected = answers[currentStep.key]?.includes(opt);
                return (
                  <button
                    key={opt}
                    id={`choice-multi-${currentStep.id}-${idx}`}
                    onClick={() => toggleArrayAnswer(currentStep.key, opt)}
                    className={`block w-full text-center font-bold border cursor-pointer transition-all active:scale-[0.98] ${buttonSizeClass} ${
                      isSelected
                        ? 'border-black bg-black text-white shadow-md'
                        : 'border-black/10 bg-white text-black hover:border-black/30 hover:bg-black/[0.01]'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'age':
        return (
          <div className="space-y-4 md:space-y-6 flex flex-col items-center justify-center text-center w-full max-h-full" id={`step-container-${currentStep.id}`}>
            {/* Age Input Section */}
            <div className="space-y-2 w-full text-center">
              <label className="text-lg md:text-2xl font-bold block text-black px-4 text-center leading-snug w-full" id={`label-question-${currentStep.id}`}>
                {currentStep.title}
              </label>
              <div className="px-4 w-full max-w-sm mx-auto flex justify-center">
                <input
                  id="age-input"
                  type="text"
                  className="w-40 py-2.5 md:py-3.5 px-4 text-center text-base md:text-lg font-bold border-2 border-black/10 rounded-xl md:rounded-2xl bg-white text-black focus:border-black focus:outline-none focus:ring-0 shadow-inner"
                  placeholder="e.g. 25"
                  value={answers[currentStep.key] || ''}
                  onChange={(e) => updateAnswer(currentStep.key, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNext();
                  }}
                />
              </div>
            </div>

            {/* Biological Sex Section */}
            <div className="w-full max-w-md px-4 space-y-2.5" id="age-biological-sex-container">
              <span className="text-xs font-black uppercase tracking-wider text-black/60 block text-center">
                What is your biological sex?
              </span>
              <div className="grid grid-cols-2 gap-3 max-w-[240px] mx-auto">
                {['Male', 'Female'].map((sexOpt) => {
                  const isSelected = answers.sex === sexOpt;
                  return (
                    <button
                      key={sexOpt}
                      type="button"
                      id={`sex-opt-${sexOpt.toLowerCase()}`}
                      onClick={() => {
                        updateAnswer('sex', sexOpt);
                        if (sexOpt !== 'Female') {
                          updateAnswer('pregnant', null);
                        }
                      }}
                      className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] ${
                        isSelected
                          ? 'border-black bg-black text-white shadow-sm'
                          : 'border-black/10 bg-white text-black hover:border-black/30 hover:bg-black/[0.01]'
                      }`}
                    >
                      {sexOpt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pregnancy Check Section */}
            {answers.sex === 'Female' && (
              <div className="w-full max-w-md px-4 pt-3 border-t border-black/10 space-y-2.5 animate-fadeIn" id="age-pregnancy-container">
                <span className="text-xs font-black uppercase tracking-wider text-black/60 block text-center">
                  Are you or do you plan on being pregnant in the next few months?
                </span>
                <p className="text-[11px] text-black/50 font-semibold text-center leading-relaxed max-w-[300px] mx-auto">
                  So we know if there are any products or ingredients that you need to avoid.
                </p>
                <div className="grid grid-cols-2 gap-3 max-w-[200px] mx-auto">
                  {['Yes', 'No'].map((pregOpt) => {
                    const isSelected = answers.pregnant === pregOpt;
                    return (
                      <button
                        key={pregOpt}
                        type="button"
                        id={`preg-opt-${pregOpt.toLowerCase()}`}
                        onClick={() => updateAnswer('pregnant', pregOpt)}
                        className={`py-2 px-4 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] ${
                          isSelected
                            ? 'border-black bg-black text-white shadow-sm'
                            : 'border-black/10 bg-white text-black hover:border-black/30 hover:bg-black/[0.01]'
                        }`}
                      >
                        {pregOpt}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 'tone':
        const toneVal = answers[currentStep.key] !== undefined ? answers[currentStep.key] : 50;
        const colorBarColor = getSkinToneColor(toneVal);
        return (
          <div className="flex flex-col items-center justify-center text-center w-full max-h-full" id={`step-container-${currentStep.id}`}>
            <label className="text-lg md:text-2xl font-bold block text-black px-4 text-center leading-snug w-full mb-1" id={`label-question-${currentStep.id}`}>
              {currentStep.title}
            </label>
            <p className="text-xs md:text-sm font-semibold text-black/50 mb-6 text-center">
              To asses variations in skin care formulations
            </p>
            
            <div className="flex flex-row items-center justify-center space-x-12 h-64 px-4 w-full max-w-md">
              {/* Labels on the left */}
              <div className="flex flex-col justify-between h-56 text-xs text-black/55 font-extrabold text-center w-20">
                <span>Fair</span>
                <span>Medium</span>
                <span>Deep</span>
              </div>

              {/* Color Bar */}
              <div 
                className="w-28 h-56 rounded-2xl border-2 border-black/10 shadow-inner transition-colors duration-100 ease-out"
                style={{ backgroundColor: colorBarColor }}
                id="tone-color-bar"
              />

              {/* Custom Vertical Slider */}
              <div 
                ref={trackRef}
                className="relative w-12 h-56 flex items-center justify-center cursor-pointer select-none"
                id="tone-slider-container"
                onTouchStart={(e) => {
                  calculateAndSetVal(e.touches[0].clientY);
                }}
                onTouchMove={(e) => {
                  calculateAndSetVal(e.touches[0].clientY);
                }}
                onMouseDown={(e) => {
                  calculateAndSetVal(e.clientY);
                }}
                onMouseMove={(e) => {
                  if (e.buttons === 1) {
                    calculateAndSetVal(e.clientY);
                  }
                }}
              >
                {/* Straight Black Line */}
                <div className="w-[3px] bg-black h-full rounded-full" />
                
                {/* Sliding Button (Thumb) */}
                <div 
                  className="absolute w-6 h-6 rounded-full bg-black border-2 border-white shadow-xl transition-all duration-75 ease-out"
                  style={{ 
                    top: `${toneVal}%`,
                    transform: 'translateY(-50%)',
                  }}
                  id="tone-slider-thumb"
                />
              </div>
            </div>
            
            {/* Optional text indicator */}
            <p className="text-xs text-black/45 font-black uppercase tracking-wider mt-4">
              Skin tone index: {toneVal}
            </p>
          </div>
        );

      case 'text':
        return (
          <div className="space-y-4 md:space-y-6 flex flex-col items-center justify-center text-center w-full max-h-full" id={`step-container-${currentStep.id}`}>
            <label className="text-lg md:text-2xl font-bold block text-black px-4 text-center leading-snug w-full" id={`label-question-${currentStep.id}`}>
              {currentStep.title}
            </label>
            <div className="w-full max-w-md px-4">
              <input
                id="problems-input"
                type="text"
                className="w-full py-4 md:py-5 px-6 text-center text-base md:text-lg border-2 border-black/10 rounded-2xl md:rounded-3xl bg-white text-black font-bold focus:border-black focus:outline-none focus:ring-0 shadow-inner animate-fadeIn"
                placeholder="Type your response here..."
                value={answers[currentStep.key] || ''}
                onChange={(e) => updateAnswer(currentStep.key, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNext();
                }}
              />
            </div>
          </div>
        );

      case 'search_products':
        return (
          <div className="space-y-4 md:space-y-6 flex flex-col items-center w-full max-h-full" id={`step-container-${currentStep.id}`}>
            <div className="text-center px-4 w-full">
              <label className="text-xl md:text-3xl font-bold block text-black leading-snug" id={`label-question-${currentStep.id}`}>
                {currentStep.title}
              </label>
              <p className="text-sm md:text-base text-black/60 font-semibold mt-1">
                We'll check if they're a good fit for your skin and goals.
              </p>
            </div>

            {/* Product Search Input */}
            <div className="w-full max-w-md space-y-3.5 px-4 flex flex-col flex-1 min-h-0">
              <div className="relative flex-none">
                <input
                  type="text"
                  placeholder="Search catalog..."
                  className="w-full py-3 md:py-4 pl-11 pr-4 text-center text-sm border-2 border-black/10 rounded-2xl bg-white font-bold text-black focus:border-black focus:outline-none transition-all shadow-inner"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/30" />
              </div>

              <div className="flex justify-center flex-none">
                <button 
                  onClick={() => setIsAddingNewProduct(!isAddingNewProduct)}
                  className="text-[10px] font-black uppercase tracking-widest text-black/60 hover:text-black flex items-center gap-1 active:scale-95 transition-all outline-none cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isAddingNewProduct ? 'Cancel' : 'Add new product'}
                </button>
              </div>

              {isAddingNewProduct && (
                <div className="bg-black/5 p-4 rounded-2xl space-y-2 w-full border border-black/5 animate-in fade-in slide-in-from-top-2 flex-none">
                  <input 
                    placeholder="Brand"
                    className="w-full p-2.5 rounded-xl text-center text-sm bg-white border border-black/15 font-semibold text-black focus:border-black focus:outline-none focus:ring-0"
                    value={newProduct.brand}
                    onChange={e => setNewProduct({...newProduct, brand: e.target.value})}
                  />
                  <input 
                    placeholder="Product name"
                    className="w-full p-2.5 rounded-xl text-center text-sm bg-white border border-black/15 font-semibold text-black focus:border-black focus:outline-none focus:ring-0"
                    value={newProduct.name}
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                  />
                  <select 
                    className="w-full p-2.5 rounded-xl text-center text-sm bg-white border border-black/15 font-semibold text-black focus:border-black focus:outline-none focus:ring-0" 
                    value={newProduct.type} 
                    onChange={e => setNewProduct({...newProduct, type: e.target.value})}
                  >
                    <option value="">Product type</option>
                    {['Cleanser', 'Serum', 'Toner', 'Moisturizer', 'Treatment', 'Mask', 'Eye care', 'Lip care', 'Sunscreen (SPF)', 'Exfoliator', 'Oil'].map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <button 
                    onClick={addCustomProduct}
                    className="w-full py-2.5 bg-black text-white rounded-xl font-black text-xs uppercase hover:bg-black/80 transition-all active:scale-95 cursor-pointer"
                  >
                    Add Product
                  </button>
                </div>
              )}

              {isSearchingProducts && (
                <div className="text-[10px] font-black uppercase tracking-widest text-center text-black/40 animate-pulse flex-none">
                  Searching...
                </div>
              )}
              
              {productSearchResults.length > 0 && (
                <div className="max-h-36 overflow-y-auto rounded-2xl border-2 border-black/5 bg-white p-2 space-y-1 shadow-md flex-none">
                  {productSearchResults.map(p => (
                    <div 
                      key={p.id} 
                      className="p-2.5 hover:bg-black/5 rounded-xl flex justify-between items-center cursor-pointer transition-colors" 
                      onClick={() => {
                        addProductToCurrent(p);
                        setProductSearchQuery('');
                        setProductSearchResults([]);
                      }}
                    >
                      <div className="text-left">
                        <span className="text-[9px] uppercase font-black tracking-widest text-[#D1A689]">{p.brand || p.Brand}</span>
                        <span className="text-xs font-bold block text-black">{p.name || p.ProductName || p.Name}</span>
                      </div>
                      <Plus className="w-4 h-4 text-black/40" />
                    </div>
                  ))}
                </div>
              )}
              
              {/* Selected Products List */}
              <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-[80px] max-h-[30vh]">
                {(answers.currentProducts || []).map((p: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center bg-black/5 p-3 rounded-2xl border border-black/5 animate-in fade-in">
                    <div className="text-left">
                      <span className="text-[9px] uppercase font-black tracking-widest text-[#D1A689]">{p.brand || p.Brand}</span>
                      <span className="text-xs font-bold block text-black">{p.name || p.ProductName || p.Name}</span>
                    </div>
                    <button 
                      onClick={() => removeProductFromCurrent(p)} 
                      className="hover:text-red-500 transition-colors p-2 text-black/40 active:scale-90"
                    >
                      <Plus className="w-5 h-5 rotate-45 stroke-[3]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
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

  const startDermalScan = async () => {
    if (!frontPhoto) return;

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
          frontImage: frontPhoto,
          closeUpImage: closeUpPhoto,
          userAnswers: answers,
        }),
      });

      clearInterval(progressInterval);
      const data = await response.json();

      if (data.success) {
        // First check face verification coordinates returned by the model
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
          front_photo: frontPhoto,
          close_up_photo: closeUpPhoto,
        };
        setAnswers(finalAnswers);

        setTimeout(() => {
          setIsScanning(false);
          setViewMode("results");
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

  if (viewMode === 'face_scan') {
    if (isCameraActive) {
      return (
        <div 
          className="fixed inset-0 bg-[#FFFFFF] z-[999] flex flex-col items-center justify-start pt-12 p-6 md:p-12 text-black animate-fadeIn"
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
            <h2 className="text-xl md:text-3xl font-sans font-black uppercase text-black tracking-tight">
              Scan your face
            </h2>
            <p className="text-xs md:text-sm text-black/60 font-semibold">
              Live preview. Keep your camera stable.
            </p>
          </div>

          {cameraError ? (
            <div className="w-full max-w-md p-6 bg-red-50 border-2 border-red-500/20 rounded-3xl text-center space-y-4 shadow-sm animate-fadeIn">
              <Info className="w-10 h-10 text-red-500 mx-auto" />
              <p className="text-sm font-bold text-red-600">{cameraError}</p>
              <button
                type="button"
                onClick={stopCamera}
                className="py-2.5 px-6 bg-black text-white hover:bg-black/90 active:scale-95 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Go Back
              </button>
            </div>
          ) : (
            <div className="relative w-full max-w-sm aspect-[9/21] bg-neutral-950 rounded-[40px] overflow-hidden shadow-2xl border-4 border-black/5 flex items-center justify-center">
              {/* Live stream video element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1] rounded-[36px]"
              />

              {/* Futuristic holographic / scanner visual overlays */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6">
                {/* Corner holographic target markers */}
                <div className="absolute inset-4 border border-white/10 rounded-3xl">
                  {/* Top-left */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white/90 rounded-tl-xl" />
                  {/* Top-right */}
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white/90 rounded-tr-xl" />
                  {/* Bottom-left */}
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white/90 rounded-bl-xl" />
                  {/* Bottom-right */}
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white/90 rounded-br-xl" />
                </div>

                {/* Glowing neon white scanning laser bar */}
                <div 
                  className="absolute left-0 right-0 h-1 bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] opacity-95"
                  style={{
                    animation: 'scanLine 3s ease-in-out infinite'
                  }}
                />

                {/* Dotted face outline SVG guide line */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {cameraTarget === 'front' ? (
                    <svg 
                      viewBox="0 0 225 525" 
                      className="w-full h-full text-white/85 opacity-90 animate-pulse animate-duration-3000"
                    >
                      {/* Beautiful larger vertical oval (ellipse) to make user take closer face scan */}
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
                      className="w-full h-full text-white/85 opacity-90 animate-pulse animate-duration-3000"
                    >
                      {/* Spot target / crosshair for Close-up photo */}
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
            <p className="text-xs md:text-sm text-black/70 font-mono tracking-tight text-center mt-6 max-w-xs leading-relaxed">
              Align your face with the oval guide. Move closer to fill the frame for an accurate scan.
            </p>
          )}

          {!cameraError && (
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs animate-fadeIn">
              <button
                id="capture-frame-btn"
                type="button"
                onClick={capturePhoto}
                className="w-full py-4 bg-white text-black border-2 border-black hover:bg-black/5 active:scale-95 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4 text-black" />
                <span>Capture Scan</span>
              </button>
              
              <button
                id="cancel-camera-btn"
                type="button"
                onClick={stopCamera}
                className="w-full py-4 bg-black/5 text-black hover:bg-black/10 active:scale-95 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col h-[calc(100dvh-90px)] md:h-auto min-h-0 bg-transparent max-w-xl mx-auto text-black tracking-normal w-full pb-4 mb-2"
        id="face-scan-container"
      >
        <h2 className="text-lg md:text-2xl font-sans font-black uppercase text-center text-black mb-1 tracking-tight">
          Let's see your face
        </h2>
        <p className="text-[11px] md:text-sm text-black/60 font-semibold mb-4 text-center">
          Take or upload photos of your skin for more accurate insights.
        </p>

        {isScanning ? (
          /* SCANNING LOADER STATE */
          <div className="flex flex-col items-center justify-center py-10 space-y-6" id="scanning-loader">
            <div className="relative w-40 h-40 rounded-2xl overflow-hidden border-2 border-dashed border-black/15 bg-black/5 flex items-center justify-center">
              {frontPhoto ? (
                <img src={frontPhoto} alt="Front face scan" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-10 h-10 text-black/25 animate-pulse" />
              )}
              {/* Laser scanner effect */}
              <div 
                className="absolute left-0 w-full h-1 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-bounce" 
                style={{ animationDuration: '2s' }}
              />
            </div>

            <div className="w-full max-w-xs space-y-2 text-center">
              <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-black/60">
                <span>{scanStepName}</span>
                <span>{scanProgress}%</span>
              </div>
              <div className="w-full h-2 bg-black/10 rounded-full overflow-hidden">
                <div 
                  className="h-2 bg-black rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-black/40 font-semibold uppercase tracking-widest text-center animate-pulse animate-duration-1000">
              Dermal scanning in progress...
            </p>
          </div>
        ) : (
          /* NORMAL CAPTURE UPLOAD STATE */
          <div className="space-y-6 flex-1 min-h-0 overflow-y-auto pr-1" id="capturing-uploads-phase">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: Front facing */}
              <div className="flex flex-col space-y-2">
                <span className="text-sm uppercase font-black tracking-widest text-black/70 flex items-center">
                  1. Front-Facing Photo
                </span>
                <span className="text-xs font-semibold text-black/50 leading-normal">
                  Capture in well-lit natural light facing the lens directly.
                </span>

                {frontPhoto ? (
                  <div className="border-2 border-black rounded-2xl aspect-square relative overflow-hidden bg-transparent">
                    <img src={frontPhoto} alt="Front Facing selfie" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                      <button 
                        type="button"
                        onClick={() => setFrontPhoto(null)}
                        className="bg-white text-black rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-white/90 active:scale-95 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Retake</span>
                      </button>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFrontPhoto(null); }}
                      className="absolute top-3 right-3 bg-black/80 text-white rounded-full p-1.5 hover:bg-black transition-all active:scale-90"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-black/15 rounded-2xl p-6 flex flex-col items-center justify-center aspect-square bg-black/[0.01] text-center">
                    <div className="space-y-4 flex flex-col items-center w-full max-w-[220px]">
                      <div className="p-3 bg-black/5 rounded-full text-black">
                        <Camera className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-black uppercase tracking-wide text-black">Dermal Scan Quiz</h4>
                        <p className="text-[10px] text-black/50 font-semibold leading-normal">
                          Ready to scan your skin using the front selfie camera?
                        </p>
                      </div>
                      
                      <button
                        id="ready-camera-btn"
                        type="button"
                        onClick={startCamera}
                        className="w-full py-3 bg-black hover:bg-black/90 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4 text-green-400" />
                        <span>Ready</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => document.getElementById('front-file-input')?.click()}
                        className="text-[10px] text-black/50 hover:text-black font-semibold uppercase tracking-wider cursor-pointer underline mt-1 animate-fadeIn"
                      >
                        Upload file instead
                      </button>

                      <input 
                        type="file" 
                        id="front-file-input" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={(e) => handlePhotoUpload(e, true)}
                      />
                    </div>
                  </div>
                )}

                {photoVerificationError && (
                  <div className="text-[10px] text-red-600 font-bold bg-red-50 p-2.5 rounded-xl border border-red-100/40 flex items-start gap-1.5 mt-1.5 animate-fadeIn text-left max-w-full leading-normal">
                    <Info className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <span>{photoVerificationError}</span>
                  </div>
                )}
              </div>

              {/* Box 2: Close-up */}
              <div className="flex flex-col space-y-2">
                <span className="text-sm uppercase font-black tracking-widest text-black/70 flex items-center">
                  2. Close-Up Photo
                </span>
                <span className="text-xs font-semibold text-black/50 leading-normal">
                  Zoom in on specific concern areas (redness, flaking, or spots). Optional.
                </span>

                {closeUpPhoto ? (
                  <div className="border-2 border-black rounded-2xl aspect-square relative overflow-hidden bg-transparent">
                    <img src={closeUpPhoto} alt="Close Up selfie" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                      <button 
                        type="button"
                        onClick={() => setCloseUpPhoto(null)}
                        className="bg-white text-black rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-white/90 active:scale-95 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Retake</span>
                      </button>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setCloseUpPhoto(null); }}
                      className="absolute top-3 right-3 bg-black/80 text-white rounded-full p-1.5 hover:bg-black transition-all active:scale-90"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-black/15 rounded-2xl p-6 flex flex-col items-center justify-center aspect-square bg-black/[0.01] text-center">
                    <div className="space-y-4 flex flex-col items-center w-full max-w-[220px]">
                      <div className="p-3 bg-black/5 rounded-full text-black">
                        <Camera className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-black uppercase tracking-wide text-black">Close-up / Spot Scan</h4>
                        <p className="text-[10px] text-black/50 font-semibold leading-normal">
                          Ready to scan your target area with the live camera?
                        </p>
                      </div>
                      
                      <button
                        id="ready-closeup-camera-btn"
                        type="button"
                        onClick={() => startCamera('closeup')}
                        className="w-full py-3 bg-black hover:bg-black/90 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4 text-green-400" />
                        <span>Ready</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => document.getElementById('closeup-file-input')?.click()}
                        className="text-[10px] text-black/50 hover:text-black font-semibold uppercase tracking-wider cursor-pointer underline mt-1 animate-fadeIn"
                      >
                        Upload file instead
                      </button>

                      <input 
                        type="file" 
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
                    className="text-[10px] font-black uppercase tracking-wider text-black/40 hover:text-black/80 transition-all text-center mt-1"
                  >
                    💡 Use Demo Close-up
                  </button>
                )}
              </div>
            </div>

            {/* Error disclaimer */}

            {/* Action controls */}
            <div className="flex justify-between items-center border-t border-black/5 pt-4">
              <button
                onClick={handleBack}
                className="text-black/50 hover:text-black font-semibold text-sm flex items-center gap-1.5 min-h-[44px]"
              >
                <ArrowLeft className="w-4 h-4" /> Back to questions
              </button>

              <button
                onClick={startDermalScan}
                disabled={!frontPhoto}
                className="btn-primary flex items-center gap-2 !text-xs !py-3 !px-6 cursor-pointer disabled:opacity-40"
              >
                Analyze Face <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  if (viewMode === 'confirm_scan') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col h-[calc(100dvh-90px)] md:h-auto min-h-0 bg-transparent max-w-xl mx-auto text-black tracking-normal w-full animate-fadeIn pb-4 mb-2"
        id="confirm-scan-container"
      >
        <h2 className="text-lg md:text-2xl font-sans font-black uppercase text-center text-black mb-1 tracking-tight">
          Scan Results Determined
        </h2>
        <p className="text-[11px] md:text-sm text-black/60 font-semibold mb-4 text-center">
          Dermal coordinates mapped successfully. Fine-tune your ratings below if your live experience differs.
        </p>

        <div className="space-y-5 flex-1 min-h-0 overflow-y-auto pr-1 pb-4" id="metrics-tuning-panel">
          {/* Item 1: Redness score slider & redness area dropdown */}
          <div className="bg-black/[0.02] border border-black/5 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase font-black tracking-widest text-black/70 flex items-center gap-1.5">
                🔴 Redness Intensity
              </span>
              <span className="text-xs font-black bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-full">
                {rednessScore} / 100
              </span>
            </div>
            
            <input 
              type="range"
              min="0"
              max="100"
              className="w-full h-1.5 bg-black/10 rounded-lg appearance-none cursor-pointer accent-black"
              value={rednessScore}
              onChange={(e) => setRednessScore(parseInt(e.target.value))}
            />
            <div className="flex justify-between text-[10px] text-black/40 font-black uppercase">
              <span>0 (None)</span>
              <span>50 (Moderate)</span>
              <span>100 (Maximum Redness)</span>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs font-bold text-black/75">
              <span>Target Redness Area:</span>
              <select
                className="bg-white border text-xs border-black/10 hover:border-black/20 rounded-xl px-2.5 py-1.5 font-bold focus:border-black focus:outline-none focus:ring-0 cursor-pointer text-xs"
                value={rednessMainArea}
                onChange={(e) => setRednessMainArea(e.target.value)}
              >
                {['Cheeks', 'Nose', 'Forehead', 'Chin', 'All over', 'None'].map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Item 2: Wrinkles score slider & wrinkles area dropdown */}
          <div className="bg-black/[0.02] border border-black/5 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase font-black tracking-widest text-black/70 flex items-center gap-1.5">
                👵 Wrinkle Density
              </span>
              <span className="text-xs font-black bg-purple-50 text-purple-600 border border-purple-100 px-2.5 py-1 rounded-full">
                {wrinklesScore} / 100
              </span>
            </div>

            <input 
              type="range"
              min="0"
              max="100"
              className="w-full h-1.5 bg-black/10 rounded-lg appearance-none cursor-pointer accent-black"
              value={wrinklesScore}
              onChange={(e) => setWrinklesScore(parseInt(e.target.value))}
            />
            <div className="flex justify-between text-[10px] text-black/40 font-black uppercase">
              <span>0 (None)</span>
              <span>50 (Moderate)</span>
              <span>100 (Super Wrinkled)</span>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs font-bold text-black/75">
              <span>Target Wrinkle Area:</span>
              <select
                className="bg-white border text-xs border-black/10 hover:border-black/20 rounded-xl px-2.5 py-1.5 font-bold focus:border-black focus:outline-none focus:ring-0 cursor-pointer text-xs"
                value={wrinklesMainArea}
                onChange={(e) => setWrinklesMainArea(e.target.value)}
              >
                {['Forehead', 'Under Eyes', 'Smile lines', 'Crow\'s feet', 'None'].map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Item 3: Acne Type dropdown */}
          <div className="bg-black/[0.02] border border-black/5 rounded-2xl p-4 flex items-center justify-between text-xs font-bold text-black/75">
            <span className="uppercase font-black text-black/70 tracking-widest block text-left">
              🧼 Acne status
              <span className="block text-[10px] text-black/40 font-semibold normal-case mt-0.5">Diagnose primary comedonal patterns.</span>
            </span>
            <select
              className="bg-white border text-xs border-black/10 hover:border-black/20 rounded-xl px-2.5 py-1.5 font-bold focus:border-black focus:outline-none focus:ring-0 cursor-pointer text-xs max-w-[200px]"
              value={scanAcneType}
              onChange={(e) => setScanAcneType(e.target.value)}
            >
              {[
                'None', 
                'Open Comedones', 
                'Closed Comedones', 
                'Post-Inflammatory Erythema', 
                'Post-Inflammatory Hyperpigmentation', 
                'Papules', 
                'Cluster of red bumps (Conglobate / Acne Rash)', 
                'Pustules', 
                'Nodules', 
                'Cystic Acne'
              ].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex justify-between items-center border-t border-black/5 pt-4 font-bold">
          <button
            onClick={handleBack}
            className="text-black/50 hover:text-black text-sm flex items-center gap-1.5 min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" /> Change photos
          </button>

          <button
            onClick={() => {
              // Commit skin scan variables onto answers state so that mapAnswersToProfile captures them
              const finalAnswers = {
                ...answers,
                redness_score: rednessScore,
                wrinkles_score: wrinklesScore,
                redness_main_area: rednessMainArea,
                wrinkels_main_area: wrinklesMainArea,
                scan_acne_type: scanAcneType,
                front_photo: frontPhoto,
                close_up_photo: closeUpPhoto
              };
              setAnswers(finalAnswers);
              setViewMode('results');
            }}
            className="btn-primary flex items-center gap-2 !text-xs !py-3 !px-6 cursor-pointer"
          >
            See Full Analysis <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div
      className="flex flex-col h-full w-full min-h-0 justify-between px-2 md:px-0 pb-2 bg-transparent"
      id="questionnaire-flow-container"
    >
      {/* Top Section: Title & progress indicators */}
      <div className="flex-none pt-1 md:pt-4" id="questionnaire-top-section">
        {/* Title block - altered italic to straight standard text */}
        <h2
          id="questionnaire-heading"
          className="text-base md:text-2xl font-sans font-black mb-1 md:mb-6 text-center text-black uppercase tracking-tight"
        >
          {titles[currentPart as keyof typeof titles]}
        </h2>

        {/* Progress Block */}
        <div className="space-y-1 mb-2 md:mb-6 px-2" id="questionnaire-progress-bar-container">
          <div className="flex justify-end text-[10px] md:text-xs font-black uppercase tracking-widest text-black/60" id="questionnaire-progress-text">
            <span>{stepIndex + 1} / {activeSteps.length}</span>
          </div>
          <div className="w-full h-1 md:h-2 bg-black/10 rounded-full">
            <div
              id="questionnaire-progress-bar-fill"
              className="h-1 md:h-2 bg-black rounded-full transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / activeSteps.length) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Middle Section: Centered content that fits dynamically in the current view */}
      <div 
        className={`flex-1 flex flex-col justify-start md:justify-center items-center min-h-0 w-full py-4 no-scrollbar ${
          currentStep?.id === 'goals' || currentStep?.type === 'search_products' || currentStep?.type === 'multiple'
            ? 'overflow-y-auto' 
            : 'overflow-hidden'
        }`}
        id="questionnaire-middle-section"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep?.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="w-full flex-1 flex flex-col justify-start md:justify-center items-center py-2 px-1"
            id={`anim-wrapper-${currentStep?.id}`}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Action Buttons Block - Pinned to the bottom of the viewport card */}
      <div className="flex-none flex justify-between pt-4 pb-2 border-t border-black/5 px-4" id="questionnaire-controls">
        <button
          id="questionnaire-back-btn"
          onClick={handleBack}
          disabled={stepIndex === 0}
          className="text-black/50 disabled:opacity-0 flex items-center gap-2 cursor-pointer font-bold text-sm min-h-[44px] hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {showNextButton && (
          <button
            id="questionnaire-next-btn"
            onClick={handleNext}
            className="btn-primary flex items-center gap-2 !text-sm !py-3 !px-6 cursor-pointer"
          >
            {stepIndex === activeSteps.length - 1 ? 'Complete' : 'Next'}{' '}
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

const Results = ({ answers, onComplete }: any) => {
  const profile = mapAnswersToProfile(answers);
  const reportText = generateSkinReportText(profile);

  const rScore = answers.redness_score !== undefined ? answers.redness_score : null;
  const wScore = answers.wrinkles_score !== undefined ? answers.wrinkles_score : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-3.5 text-left p-6 md:p-8 bg-transparent max-w-xl animate-fadeIn w-full"
      id="questionnaire-results-container"
    >
      <h2 className="text-2xl md:text-3xl font-sans font-black uppercase text-center text-black tracking-tight mb-1" id="results-headline">
        Your Skin Analysis
      </h2>

      {rScore !== null && (
        <div className="border border-black/5 rounded-2xl p-3 bg-stone-50/50 space-y-2.5 shadow-sm" id="results-dermal-dashboard">
          <div className="flex flex-col space-y-2.5">
            {/* Redness score progress block */}
            <div className="flex flex-col space-y-1.5 bg-white p-3 rounded-xl border border-black/5 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm uppercase font-black text-black/60 tracking-wider">Redness</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg sm:text-xl font-black text-red-600 font-sans">{rScore}%</span>
                </div>
              </div>
              <div className="w-full bg-black/5 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-red-400 to-red-600 h-full rounded-full transition-all duration-1000" style={{ width: `${rScore}%` }} />
              </div>
            </div>

            {/* Wrinkles score progress block */}
            <div className="flex flex-col space-y-1.5 bg-white p-3 rounded-xl border border-black/5 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm uppercase font-black text-black/60 tracking-wider">Wrinkle Density</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg sm:text-xl font-black text-violet-600 font-sans">{wScore}%</span>
                </div>
              </div>
              <div className="w-full bg-black/5 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-violet-400 to-violet-600 h-full rounded-full transition-all duration-1000" style={{ width: `${wScore}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clinical Diagnosis Sentence Block */}
      <div className="bg-black/[0.02] border border-black/5 p-4 md:p-5 rounded-2xl relative overflow-hidden" id="report-text-card">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#D1A689]" />
        <span className="text-[9px] uppercase font-black text-black/40 tracking-widest block mb-1">Diagnostic Summary report</span>
        <p className="text-sm md:text-base font-semibold text-black/80 tracking-normal italic leading-relaxed">
          "{reportText}"
        </p>
      </div>

      <button
        onClick={() => onComplete(answers)}
        className="btn-primary w-full cursor-pointer justify-center flex items-center min-h-[48px] text-sm md:text-base font-black uppercase tracking-widest"
        id="questionnaire-complete-btn"
      >
        Sign up to find out more
      </button>
    </motion.div>
  );
};
