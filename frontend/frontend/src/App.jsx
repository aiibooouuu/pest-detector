import { useState, useRef, useCallback, useEffect } from "react";
import CameraCapture from "./components/CameraCapture";
import { Search, Camera, History, BookOpen, Settings, ChevronLeft, ChevronRight, Sun, Moon, Upload, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const PEST_INFO = {
  Whitefly: {
    risk: "High",
    crop_impact: "Sucks sap, causes yellowing and wilting",
    treatment: "Neem oil spray or yellow sticky traps",
    spread: "Very Fast",
    icon: "🦟",
    whatToDo: [
      "Apply neem oil spray every 7-10 days",
      "Install yellow sticky traps around plants",
      "Remove heavily infested leaves",
      "Maintain proper plant spacing for air circulation",
      "Water plants early in the morning",
    ],
    whatNotToDo: [
      "Do not use excessive pesticides (can kill beneficial insects)",
      "Avoid overhead watering (promotes fungal diseases)",
      "Do not ignore early signs of infestation",
      "Don't plant susceptible crops continuously",
      "Avoid working in field when plants are wet",
    ],
    preventionTips: [
      "Use resistant crop varieties",
      "Practice crop rotation",
      "Keep weeds under control",
      "Monitor plants regularly for early detection",
      "Use mulch to reduce pest habitat",
    ],
    whyItHappens: "Whiteflies thrive in warm, humid conditions. They multiply rapidly and feed on plant sap, weakening the crop. They also transmit plant viruses.",
  },
  Jassid: {
    risk: "Medium",
    crop_impact: "Causes leaf curl and stunted growth",
    treatment: "Imidacloprid spray, remove affected leaves",
    spread: "Moderate",
    icon: "🐛",
    whatToDo: [
      "Spray imidacloprid or similar insecticides bi-weekly",
      "Remove and destroy affected leaves immediately",
      "Increase irrigation during dry periods",
      "Apply organic neem spray as alternative",
      "Scout fields regularly for early detection",
    ],
    whatNotToDo: [
      "Don't overuse chemical pesticides",
      "Avoid continuous spraying (builds resistance)",
      "Don't neglect field sanitation",
      "Avoid water stress during critical growth stages",
      "Don't mix different pesticides without guidance",
    ],
    preventionTips: [
      "Use certified pest-free seeds",
      "Remove volunteer plants and weeds",
      "Practice inter-cropping",
      "Release natural predators like ladybugs",
      "Maintain optimal soil moisture",
    ],
    whyItHappens: "Jassids are leaf-hoppers that pierce plant tissues and suck sap. They cause leaf curling and stunted growth by transmitting pathogens and reducing photosynthesis.",
  },
  adult_hopper: {
    risk: "High",
    crop_impact: "Transmits plant viruses, reduces yield",
    treatment: "Thiamethoxam insecticide, field hygiene",
    spread: "Fast",
    icon: "🦗",
    whatToDo: [
      "Apply Thiamethoxam spray at first sign",
      "Remove infected plants immediately",
      "Maintain strict field hygiene",
      "Use reflective mulches to confuse insects",
      "Install row covers on young plants",
    ],
    whatNotToDo: [
      "Don't delay treatment (spreads quickly)",
      "Avoid planting near infected fields",
      "Don't reuse infected plant material",
      "Avoid overcrowding of plants",
      "Don't ignore virus symptoms",
    ],
    preventionTips: [
      "Use virus-resistant varieties",
      "Control alternative host plants",
      "Maintain isolation distance from other crops",
      "Use certified virus-free planting material",
      "Monitor borders for hopper activity",
    ],
    whyItHappens: "Adult hoppers are vectors of plant viruses. They move fast and spread diseases quickly between plants, leading to rapid yield loss.",
  },
  borer: {
    risk: "Very High",
    crop_impact: "Destroys stems from inside, kills plant",
    treatment: "Chlorpyrifos spray, remove bored stems",
    spread: "Slow",
    icon: "🐜",
    whatToDo: [
      "Apply Chlorpyrifos or Cartap spray when damage is noticed",
      "Remove and burn infested stems immediately",
      "Inject insecticide into bored stems",
      "Practice deeper planting of seedlings",
      "Remove crop residues after harvest",
    ],
    whatNotToDo: [
      "Don't delay removal of infested plants",
      "Avoid storing infected crop material near fields",
      "Don't leave crop residues in field",
      "Avoid continuous planting of same crop",
      "Don't ignore small entry holes in stems",
    ],
    preventionTips: [
      "Use resistant varieties",
      "Practice crop rotation (2-3 years)",
      "Use pheromone traps for monitoring",
      "Maintain field sanitation",
      "Timely harvesting prevents carryover",
    ],
    whyItHappens: "Stem borers tunnel inside plant stems, cutting off nutrient transport and eventually killing the plant. Once inside, they are hard to control chemically.",
  },
  pest: {
    risk: "Medium",
    crop_impact: "General crop damage, monitor closely",
    treatment: "Identify specific pest for targeted treatment",
    spread: "Unknown",
    icon: "🐞",
    whatToDo: [
      "Identify the specific pest type",
      "Monitor crop regularly for changes",
      "Take preventive measures based on pest type",
      "Consult with agricultural expert if unsure",
      "Document observations for future reference",
    ],
    whatNotToDo: [
      "Don't assume it's a specific pest without confirmation",
      "Avoid random pesticide application",
      "Don't panic and overtreat",
      "Don't ignore spreading patterns",
    ],
    preventionTips: [
      "Regular field monitoring",
      "Maintain good field hygiene",
      "Practice crop rotation",
      "Use integrated pest management",
    ],
    whyItHappens: "Unknown pest detected. Could be various insects affecting crop. Proper identification is crucial for effective management.",
  },
};

const RISK_COLOR_LIGHT = {
  "Very High": { bg: "#fff1f0", text: "#cf1322", dot: "#f5222d" },
  High:        { bg: "#fff7e6", text: "#d46b08", dot: "#fa8c16" },
  Medium:      { bg: "#fffbe6", text: "#7c5a00", dot: "#faad14" },
  Low:         { bg: "#f6ffed", text: "#389e0d", dot: "#52c41a" },
};

const RISK_COLOR_DARK = {
  "Very High": { bg: "#2d1010", text: "#ff7875", dot: "#f5222d" },
  High:        { bg: "#2d1f08", text: "#ffa940", dot: "#fa8c16" },
  Medium:      { bg: "#2a2000", text: "#ffd666", dot: "#faad14" },
  Low:         { bg: "#0d2b12", text: "#73d13d", dot: "#52c41a" },
};

const NAV_ITEMS = [
  { id: "scan", label: "Scan", icon: Search, desc: "Detect pests" },
  { id: "history", label: "History", icon: History, desc: "Past scans" },
  { id: "info", label: "Information", icon: BookOpen, desc: "Pest database" },
  { id: "guide", label: "Guide", icon: BookOpen, desc: "Learn more" },
  { id: "settings", label: "Settings", icon: Settings, desc: "Preferences" },
];

export default function App() {
  const [dark,       setDark]       = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [image,      setImage]      = useState(null);
  const [detections, setDetections] = useState([]);
  const [annotated,  setAnnotated]  = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [mode,       setMode]       = useState("upload");
  const [scanTime,   setScanTime]   = useState(null);
  const [activeNav,  setActiveNav]  = useState("scan");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [scanHistory, setScanHistory] = useState([]);
  const [selectedPestInfo, setSelectedPestInfo] = useState(null);
  const fileRef = useRef();

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("pestScanHistory");
    if (saved) {
      setScanHistory(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const RISK_COLOR = dark ? RISK_COLOR_DARK : RISK_COLOR_LIGHT;

  const t = (light, darkVal) => dark ? darkVal : light;

  const reset = () => {
    setImage(null); setDetections([]); setAnnotated(null);
    setError(null); setScanTime(null);
  };

  const saveScanToHistory = (detections, scanTime, annotated) => {
    const scan = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      pestCount: detections.length,
      highestRisk: detections.length ? detections[0]?.label : "None",
      scanTime,
      annotatedImage: annotated,
      detections: detections, // Store full detection data
    };
    const newHistory = [scan, ...scanHistory].slice(0, 20);
    setScanHistory(newHistory);
    localStorage.setItem("pestScanHistory", JSON.stringify(newHistory));
  };

  const runDetection = useCallback(async (file) => {
    setLoading(true); setError(null);
    setImage(URL.createObjectURL(file));
    const t0 = Date.now();
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res  = await fetch(`${API_URL}/detect`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setAnnotated(`data:image/jpeg;base64,${data.annotated_image}`);
      setDetections(data.detections);
      const time = ((Date.now() - t0) / 1000).toFixed(1);
      setScanTime(time);
      saveScanToHistory(data.detections, time, `data:image/jpeg;base64,${data.annotated_image}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [scanHistory]);

  const highestRisk = detections.reduce((top, d) => {
    const order = { "Very High": 4, High: 3, Medium: 2, Low: 1, Unknown: 0 };
    const info = PEST_INFO[d.label] || PEST_INFO.pest;
    return (order[info.risk] || 0) > (order[top] || 0) ? info.risk : top;
  }, "Low");

  const hasResults = !loading && annotated;

  const C = {
    bg:             t("#f8faf8", "#0f1a13"),
    surface:        t("#ffffff", "#162419"),
    surfaceAlt:     t("#f8faf8", "#1c2e22"),
    sidebarBg:      t("#ffffff", "#1a2e22"),
    border:         t("#d8f3dc", "#2a4030"),
    borderCard:     t("#edf7ed", "#1e3328"),
    text:           t("#1b4332", "#d8f3dc"),
    textMuted:      t("#74c69d", "#52b788"),
    textHint:       t("#95d5b2", "#3a7d55"),
    accent:         t("#2d6a4f", "#52b788"),
    accentLight:    t("#d8f3dc", "#1e3a2a"),
    logoMark:       t("#d8f3dc", "#1e3a2a"),
    logoStroke:     t("#2d6a4f", "#52b788"),
    confTrack:      t("#f0f7f0", "#1a2e20"),
    treatmentBg:    t("#f0f9f2", "#0d2218"),
    treatmentBorder:t("#52b788", "#2d6a4f"),
    errorBg:        t("#fff5f5", "#2d1010"),
    errorBorder:    t("#ffd6d6", "#5c1a1a"),
    errorText:      t("#c0392b", "#ff7875"),
    navActive:      t("#e8f5e9", "#1e3a2a"),
    navActiveTxt:   t("#2d6a4f", "#52b788"),
    uploadBorder:   t("#95d5b2", "#2a4030"),
    uploadBg:       t("#ffffff", "#162419"),
  };

  return (
    <div style={{ display: "flex", background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? 280 : 80,
        background: C.sidebarBg,
        borderRight: `1px solid ${C.border}`,
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.3s ease",
        position: "relative",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32, cursor: "pointer" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: C.logoMark, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Search size={22} color={C.logoStroke} />
          </div>
          {sidebarOpen && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.3px" }}>PestScan</div>
              <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 500, letterSpacing: "0.3px" }}>Pro</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveNav(item.id); if (item.id === "scan") reset(); }}
              title={item.label}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: `1.5px solid ${activeNav === item.id ? C.accent : "transparent"}`,
                background: activeNav === item.id ? C.navActive : "transparent",
                color: activeNav === item.id ? C.navActiveTxt : C.textMuted,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12,
                transition: "all 0.2s ease",
              }}
            >
              <item.icon size={18} />
              {sidebarOpen && (
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>{item.desc}</div>
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            width: "100%",
            padding: "10px",
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            cursor: "pointer",
            color: C.text,
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={() => setDark(d => !d)}
          title="Toggle dark mode"
          style={{
            width: "100%",
            height: 44,
            borderRadius: 10,
            border: `1.5px solid ${C.border}`,
            background: C.surface,
            cursor: "pointer",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        
        {/* Top Bar */}
        <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>
              {NAV_ITEMS.find(i => i.id === activeNav)?.label}
            </h1>
            <p style={{ fontSize: 12, color: C.textMuted, margin: "4px 0 0", fontWeight: 500 }}>
              {NAV_ITEMS.find(i => i.id === activeNav)?.desc}
            </p>
          </div>
          {hasResults && (
            <button
              onClick={reset}
              style={{ fontSize: 13, fontWeight: 600, color: C.accent, background: C.accentLight, border: "none", borderRadius: 20, padding: "10px 20px", cursor: "pointer" }}
            >
              New Scan
            </button>
          )}
        </header>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
          
          {/* Scan Tab */}
          {activeNav === "scan" && (
            <div style={{ maxWidth: 600, margin: "0 auto" }}>
              {/* Mode toggle */}
              {!hasResults && !loading && (
                <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                  {[
                    { id: "upload", label: "Upload Photo", icon: Upload },
                    { id: "camera", label: "Camera", icon: Camera }
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      style={{
                        flex: 1, padding: "14px 16px", borderRadius: 14, fontSize: 15, fontWeight: 600,
                        border: `1.5px solid ${mode === m.id ? C.accent : C.border}`,
                        background: mode === m.id ? C.accent : C.surface,
                        color: mode === m.id ? "#fff" : C.textMuted,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      <m.icon size={18} />
                      {m.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Upload zone */}
              {mode === "upload" && !image && !loading && (
                <div
                  onClick={() => fileRef.current.click()}
                  style={{ border: `2px dashed ${C.uploadBorder}`, borderRadius: 24, background: C.uploadBg, padding: "64px 32px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}
                >
                  <div style={{ marginBottom: 20 }}>
                    <Upload size={48} color={C.accent} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>Drop a photo here</div>
                  <div style={{ fontSize: 14, color: C.textHint }}>or tap to browse · JPG, PNG</div>
                  <input ref={fileRef} type="file" accept="image/*" onChange={e => e.target.files[0] && runDetection(e.target.files[0])} hidden />
                </div>
              )}

              {/* Camera */}
              {mode === "camera" && !image && !loading && (
                <CameraCapture dark={dark} onCapture={(f) => { setMode("upload"); runDetection(f); }} />
              )}

              {/* Loading */}
              {loading && (
                <div style={{ marginTop: 8, borderRadius: 20, overflow: "hidden", position: "relative" }}>
                  {image && <img src={image} alt="" style={{ width: "100%", display: "block", maxHeight: "55vh", objectFit: "cover" }} />}
                  <div style={{ position: "absolute", inset: 0, background: "rgba(15,26,19,0.65)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "80%", height: 2, background: "#52b788", boxShadow: "0 0 12px #52b788", animation: "scanAnim 1.4s ease-in-out infinite" }} />
                    <div style={{ color: "#d8f3dc", fontSize: 15, fontWeight: 600, marginTop: 20, letterSpacing: "1px" }}>Analysing...</div>
                  </div>
                </div>
              )}

              {/* Results */}
              {hasResults && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
                    {[
                      { val: detections.length, key: "Pests found", color: C.text },
                      { val: detections.length ? highestRisk : "None", key: "Risk level", color: detections.length ? (RISK_COLOR[highestRisk]?.text || C.text) : C.accent },
                      { val: `${scanTime}s`, key: "Scan time", color: C.text },
                    ].map((s, i) => (
                      <div key={i} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: "18px 16px", textAlign: "center" }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.val}</div>
                        <div style={{ fontSize: 11, color: C.textHint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.key}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", marginBottom: 24 }}>
                    <img src={annotated} alt="Detection result" style={{ width: "100%", display: "block" }} />
                    <div style={{ position: "absolute", top: 14, left: 14, background: "rgba(15,26,19,0.85)", color: "#d8f3dc", fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 20 }}>
                      Detection result
                    </div>
                  </div>

                  {detections.length === 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 16, background: C.surface, borderRadius: 16, padding: "24px", border: `1px solid ${C.border}`, marginBottom: 16 }}>
                      <CheckCircle size={32} color={C.accent} />
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 2 }}>Crop looks healthy</div>
                        <div style={{ fontSize: 13, color: C.textMuted }}>No pests detected. Continue regular monitoring.</div>
                      </div>
                    </div>
                  )}

                  {detections.map((d, i) => {
                    const info = PEST_INFO[d.label] || PEST_INFO.pest;
                    const rc   = RISK_COLOR[info.risk] || RISK_COLOR.Medium;
                    return (
                      <div key={i} style={{ background: C.surface, borderRadius: 18, padding: "20px", border: `1px solid ${C.borderCard}`, marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                          <div style={{ fontSize: 32, lineHeight: 1 }}>{info.icon}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{d.pest_name}</div>
                            <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, marginTop: 2 }}>{d.stage} stage</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 20, background: rc.bg, color: rc.text }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: rc.dot, display: "inline-block" }} />
                            {info.risk}
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 12, color: C.textHint, fontWeight: 600 }}>Confidence</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{d.confidence}%</span>
                        </div>
                        <div style={{ height: 6, background: C.confTrack, borderRadius: 4, marginBottom: 18 }}>
                          <div style={{ height: 6, borderRadius: 4, width: `${d.confidence}%`, background: d.confidence > 70 ? C.accent : d.confidence > 45 ? C.textMuted : C.textHint, transition: "width .5s ease" }} />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                          {[{ label: "Crop Impact", val: info.crop_impact }, { label: "Spread Speed", val: info.spread }].map(cell => (
                            <div key={cell.label} style={{ background: C.surfaceAlt, borderRadius: 12, padding: "12px 14px" }}>
                              <div style={{ fontSize: 10, color: C.textHint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{cell.label}</div>
                              <div style={{ fontSize: 13, color: C.text, fontWeight: 500, lineHeight: 1.4 }}>{cell.val}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ background: C.treatmentBg, borderRadius: 12, padding: "14px 16px", borderLeft: `4px solid ${C.treatmentBorder}` }}>
                          <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Recommended Treatment</div>
                          <div style={{ fontSize: 13, color: C.text, fontWeight: 500, lineHeight: 1.6 }}>{info.treatment}</div>
                        </div>

                        <button
                          onClick={() => setSelectedPestInfo(d.label)}
                          style={{ width: "100%", marginTop: 14, padding: "10px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                        >
                          View Detailed Guide
                        </button>
                      </div>
                    );
                  })}

                  <div style={{ textAlign: "center", fontSize: 12, color: C.textHint, padding: "24px 0", lineHeight: 1.6 }}>
                    Scan results are AI-generated. Consult an agronomist for severe infestations.
                  </div>
                </>
              )}

              {error && (
                <div style={{ background: C.errorBg, borderRadius: 16, padding: 28, textAlign: "center", border: `1px solid ${C.errorBorder}` }}>
                  <AlertCircle size={32} color={C.errorText} style={{ margin: "0 auto 8px" }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.errorText, marginBottom: 8 }}>Scan failed</div>
                  <div style={{ fontSize: 14, color: C.errorText, opacity: 0.8, marginBottom: 20 }}>{error}</div>
                  <button onClick={reset} style={{ background: C.errorText, color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeNav === "history" && (
            <div style={{ maxWidth: 600, margin: "0 auto" }}>
              {scanHistory.length === 0 ? (
                <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 32, textAlign: "center" }}>
                  <History size={40} color={C.textMuted} style={{ margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>No scan history yet</div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>Your past scans will appear here</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {scanHistory.map(scan => (
                    <div key={scan.id} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{scan.date}</div>
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{scan.pestCount} pests detected • {scan.scanTime}s</div>
                      </div>
                      <button
                        onClick={() => { setAnnotated(scan.annotatedImage); setActiveNav("scan"); }}
                        style={{ padding: "8px 16px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Information/Pest Database Tab */}
          {activeNav === "info" && (
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
              {selectedPestInfo ? (
                <div>
                  <button
                    onClick={() => setSelectedPestInfo(null)}
                    style={{ marginBottom: 20, padding: "8px 16px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                  >
                    ← Back to Pest List
                  </button>
                  
                  <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 32 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                      <div style={{ fontSize: 48 }}>{PEST_INFO[selectedPestInfo]?.icon}</div>
                      <div>
                        <h2 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: 0, marginBottom: 4 }}>{selectedPestInfo}</h2>
                        <div style={{ fontSize: 14, color: C.textMuted }}>Risk Level: <strong>{PEST_INFO[selectedPestInfo]?.risk}</strong></div>
                      </div>
                    </div>

                    {/* Why It Happens */}
                    <div style={{ marginBottom: 24, padding: "16px", background: C.surfaceAlt, borderRadius: 12 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>💡 Why Does This Happen?</h3>
                      <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.6 }}>{PEST_INFO[selectedPestInfo]?.whyItHappens}</p>
                    </div>

                    {/* What to Do */}
                    <div style={{ marginBottom: 24 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12 }}>✓ What To Do</h3>
                      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                        {PEST_INFO[selectedPestInfo]?.whatToDo.map((item, i) => (
                          <li key={i} style={{ fontSize: 13, color: C.text, padding: "10px 0", display: "flex", gap: 12, borderBottom: `1px solid ${C.border}` }}>
                            <CheckCircle size={18} color={C.accent} style={{ flexShrink: 0 }} />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* What NOT to Do */}
                    <div style={{ marginBottom: 24 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: C.errorText, marginBottom: 12 }}>✗ What NOT To Do</h3>
                      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                        {PEST_INFO[selectedPestInfo]?.whatNotToDo.map((item, i) => (
                          <li key={i} style={{ fontSize: 13, color: C.text, padding: "10px 0", display: "flex", gap: 12, borderBottom: `1px solid ${C.border}` }}>
                            <AlertCircle size={18} color={C.errorText} style={{ flexShrink: 0 }} />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Prevention */}
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12 }}>🛡️ Prevention Tips</h3>
                      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                        {PEST_INFO[selectedPestInfo]?.preventionTips.map((item, i) => (
                          <li key={i} style={{ fontSize: 13, color: C.text, padding: "10px 0", display: "flex", gap: 12, borderBottom: i < PEST_INFO[selectedPestInfo]?.preventionTips.length - 1 ? `1px solid ${C.border}` : "none" }}>
                            <TrendingUp size={18} color={C.accent} style={{ flexShrink: 0 }} />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
                  {Object.entries(PEST_INFO).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedPestInfo(key)}
                      style={{
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: 14,
                        padding: "20px 16px",
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => e.target.style.borderColor = C.accent}
                      onMouseLeave={(e) => e.target.style.borderColor = C.border}
                    >
                      <div style={{ fontSize: 36, marginBottom: 8 }}>{info.icon}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{key}</div>
                      <div style={{ fontSize: 11, color: C.textHint, fontWeight: 600 }}>Risk: {info.risk}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Guide Tab */}
          {activeNav === "guide" && (
            <div style={{ maxWidth: 600, margin: "0 auto" }}>
              <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 32 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 16 }}>How to use PestScan</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {[
                    { num: "1", title: "Capture Photo", desc: "Take a clear photo of the affected crop area" },
                    { num: "2", title: "Upload Image", desc: "Upload the photo or use the camera to capture" },
                    { num: "3", title: "AI Analysis", desc: "Our AI will detect and identify pests" },
                    { num: "4", title: "Get Treatment", desc: "Receive recommended treatment options" },
                  ].map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, padding: "14px", borderRadius: 12, background: C.surfaceAlt }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>
                        {step.num}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{step.title}</div>
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{step.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeNav === "settings" && (
            <div style={{ maxWidth: 600, margin: "0 auto" }}>
              <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 32 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 20 }}>Settings</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {[
                    { label: "Notifications", value: "Enabled" },
                    { label: "Data Usage", value: "Optimize" },
                    { label: "App Version", value: "1.0.0" },
                  ].map((setting, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: i < 2 ? `1px solid ${C.border}` : "none" }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{setting.label}</span>
                      <span style={{ fontSize: 13, color: C.textMuted }}>{setting.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes scanAnim {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}