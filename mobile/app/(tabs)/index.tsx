import React, { useState, useRef } from "react";
import {Alert } from "react-native";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Linking, Switch,
  KeyboardAvoidingView, Platform, Animated
} from "react-native";
import axios from "axios";

// ─── CONFIG ───────────────────────────────────
const API = "http://192.168.31.231:8000"; // change to your machine IP

// ─── COLORS ───────────────────────────────────
const C = {
  bg:       "#0a0c0f",
  surface:  "#121518",
  surface2: "#1a1e24",
  border:   "#252b34",
  accent:   "#00e5b0",
  danger:   "#ff4757",
  warning:  "#ffa502",
  purple:   "#5352ed",
  blue:     "#00c2ff",
  text:     "#e8eaed",
  muted:    "#6b7280",
  train:    "#a8a7ff",
  bus:      "#2ed573",
  cab:      "#ffa502",
  flight:   "#00c2ff",
};

const REASONS = [
  { key: "medical",  label: "🏥 Medical" },
  { key: "accident", label: "🚗 Accident" },
  { key: "family",   label: "👨‍👩‍👧 Family" },
];

const TYPE_ICONS: Record<string,string> = {
  Train:"🚆", Bus:"🚌", Cab:"🚕", Flight:"✈️"
};

// ─────────────────────────────────────────────
export default function Index() {
  const [source,      setSource]      = useState("");
  const [destination, setDestination] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [reason,      setReason]      = useState("");
  const [aadhaar,     setAadhaar]     = useState("");
  const [otp,         setOtp]         = useState("");
  const [otpCode,     setOtpCode]     = useState("");        // displayed after request
  const [otpVerified, setOtpVerified] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [otpLoading,  setOtpLoading]  = useState(false);
  const [results,     setResults]     = useState<any>(null);
  const [filter,      setFilter]      = useState("All");

  // ── Emergency toggle ──
  function onToggleEmergency(val: boolean) {
    setIsEmergency(val);
    if (!val) {
      setReason(""); setAadhaar(""); setOtp("");
      setOtpCode(""); setOtpVerified(false);
    }
  }

  // ── Request OTP ──
  async function requestOTP() {
    if (aadhaar.length !== 12 || isNaN(Number(aadhaar))) {
      alert("Enter a valid 12-digit Aadhaar number"); return;
    }
    setOtpLoading(true);
    try {
      const res = await axios.post(`${API}/request-otp?aadhaar=${aadhaar}`);
      setOtpCode(res.data.otp || "");
    } catch {
      alert("Could not reach server");
    } finally {
      setOtpLoading(false);
    }
  }

  // ── Verify OTP ──
  async function verifyOTP() {
    if (!aadhaar || !otp) { alert("Enter Aadhaar and OTP"); return; }
    try {
      const res = await axios.post(`${API}/verify-otp?aadhaar=${aadhaar}&otp=${otp}`);
      if (res.data.verified) {
        setOtpVerified(true);
        setOtpCode("");
      } else {
        alert(res.data.error || "OTP verification failed");
      }
    } catch {
      alert("Could not reach server");
    }
  }

  // ── Search ──
  async function doSearch() {
    if (!source.trim() || !destination.trim()) {
      alert("Enter source and destination"); return;
    }
    if (isEmergency) {
      if (!reason)      { alert("Select an emergency reason"); return; }
      if (!otpVerified) { alert("Please verify your Aadhaar OTP first"); return; }
    }

    setLoading(true);
    setResults(null);

    try {
      const res = await axios.get(`${API}/search`, {
        params: {
          source:           source.trim(),
          destination:      destination.trim(),
          emergency:        isEmergency,
          emergency_reason: reason || "none",
          aadhaar:          isEmergency ? aadhaar : "000000000000",
          otp_verified:     isEmergency ? otpVerified : false,
          user_id:          "app_" + Date.now(),
          demo:             ""
        },
        timeout: 8000
      });
      setResults(res.data);
      setFilter("All");
    } catch (e: any) {
      setResults({ error: e?.response?.data?.detail || e?.message || "Network error" });
    } finally {
      setLoading(false);
    }
  }

  // ── Filter routes ──
  const filteredRoutes = (results?.routes || []).filter((r: any) =>
    filter === "All" || r.steps?.some((s: any) => s.type === filter)
  );

  
  function triggerSOS() {
  Alert.alert(
    "🆘 SOS ACTIVATED",
    "This will:\n• Share your live location with police\n• Call your emergency contacts\n• Send your last known address",
    [
      { text: "Cancel", style: "cancel" },
      { text: "CONFIRM SOS", style: "destructive", onPress: () => {
          Alert.alert("✅ SOS Sent", "📍 Location shared with police\n📞 Emergency contacts notified\n🚔 Help is on the way");
        }
      }
    ]
  );
}

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
      >

        {/* HEADER */}
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={{ fontSize: 20 }}>🤝</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.appTitle}>Helping Hands</Text>
            <Text style={s.appSub}>Emergency Travel AI v3.0</Text>
          </View>
          <View style={s.liveDot}>
            <View style={s.dotGreen} />
            <Text style={s.liveText}>LIVE</Text>
          </View>
        </View>

        {/* SEARCH PANEL */}
        <View style={s.panel}>
          <Text style={s.panelLabel}>WHERE ARE YOU GOING?</Text>

          {/* From / To */}
          <View style={s.inputRow}>
            <View style={[s.inputWrap, { flex: 1 }]}>
              <Text style={s.inputIcon}>📍</Text>
              <TextInput
                style={s.input}
                placeholder="From city"
                placeholderTextColor={C.muted}
                value={source}
                onChangeText={setSource}
              />
            </View>
            <Text style={s.arrow}>→</Text>
            <View style={[s.inputWrap, { flex: 1 }]}>
              <Text style={s.inputIcon}>🎯</Text>
              <TextInput
                style={s.input}
                placeholder="To city"
                placeholderTextColor={C.muted}
                value={destination}
                onChangeText={setDestination}
              />
            </View>
          </View>

          {/* Emergency toggle */}
          <View style={[s.emRow, isEmergency && { borderColor: C.danger }]}>
            <Text style={s.emLabel}>
              🚨 Emergency Mode{"  "}
              <Text style={{ color: isEmergency ? C.danger : C.muted, fontWeight: "400", fontSize: 11 }}>
                {isEmergency ? "ON" : "OFF"}
              </Text>
            </Text>
              <Text style={{ fontSize:10, color:C.muted, marginTop:6 }}>
  💡 Enable only when time-critical — requires Aadhaar verification
</Text>
            <Switch
              value={isEmergency}
              onValueChange={onToggleEmergency}
              trackColor={{ false: C.border, true: C.danger }}
              thumbColor="#fff"
            />
          </View>

          {/* Emergency form */}
          {isEmergency && (
            <View style={s.emergencyForm}>

              {/* Reason */}
              <Text style={s.panelLabel}>EMERGENCY REASON</Text>
              <View style={s.reasonGrid}>
                {REASONS.map(r => (
                  <TouchableOpacity
                    key={r.key}
                    style={[s.reasonBtn, reason === r.key && s.reasonBtnActive]}
                    onPress={() => setReason(r.key)}
                  >
                    <Text style={[s.reasonBtnText, reason === r.key && { color: C.danger }]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Aadhaar */}
              <Text style={[s.panelLabel, { marginTop: 12 }]}>AADHAAR VERIFICATION</Text>
              <View style={s.inputWrap}>
                <Text style={s.inputIcon}>🪪</Text>
                <TextInput
                  style={s.input}
                  placeholder="12-digit Aadhaar number"
                  placeholderTextColor={C.muted}
                  keyboardType="number-pad"
                  maxLength={12}
                  value={aadhaar}
                  onChangeText={setAadhaar}
                />
              </View>

              {/* OTP row */}
              <View style={[s.inputRow, { marginTop: 10 }]}>
                <View style={[s.inputWrap, { flex: 1 }]}>
                  <TextInput
                    style={[s.input, { paddingLeft: 14 }]}
                    placeholder="Enter OTP"
                    placeholderTextColor={C.muted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={setOtp}
                  />
                </View>
                <TouchableOpacity style={s.smBtn} onPress={requestOTP} disabled={otpLoading}>
                  <Text style={s.smBtnText}>{otpLoading ? "..." : "Send OTP"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.smBtn} onPress={verifyOTP}>
                  <Text style={s.smBtnText}>Verify</Text>
                </TouchableOpacity>
              </View>

              {/* OTP display */}
              {!!otpCode && (
                <View style={s.otpDisplay}>
                  <Text style={s.otpText}>🔐 Your OTP: {otpCode}  (expires in 5 min)</Text>
                </View>
              )}

              {/* Verified badge */}
              {otpVerified && (
                <Text style={s.verifiedBadge}>✅ Aadhaar verified</Text>
              )}

            </View>
          )}

          {/* Search button */}
          <TouchableOpacity
            style={[s.mainBtn, loading && { opacity: 0.6 }]}
            onPress={doSearch}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={s.mainBtnText}>Find Best Route</Text>
            }
          </TouchableOpacity>
        </View>

        {/* RESULTS */}
        {results && (
  <View>
    {results.error ? (
      <View style={s.errCard}>
        <Text style={s.errIcon}>🚫</Text>
        <Text style={s.errMsg}>{results.error}</Text>
      </View>

    // ── SIM TRACKING MODE — no transport data ──
    ) : results.sim_tracking && !results.police_alert ? (
      <View style={{backgroundColor:"rgba(0,194,255,.07)",borderWidth:1,borderColor:"rgba(0,194,255,.4)",borderRadius:14,padding:20,marginBottom:14}}>
        <Text style={{fontSize:10,color:C.blue,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>📡 SIM Tracking Active</Text>
        <Text style={{fontSize:16,fontWeight:"800",color:C.text,marginBottom:6}}>Passenger location is being monitored</Text>
        <Text style={{fontSize:12,color:C.muted,marginBottom:16}}>Use SOS if you are in danger or need immediate help</Text>
        {results.tracking?.current_stop && (
          <View style={{flexDirection:"row",alignItems:"center",gap:12,padding:14,backgroundColor:C.surface2,borderRadius:10,marginBottom:12}}>
            <View style={{width:10,height:10,borderRadius:5,backgroundColor:C.blue}}/>
            <View>
              <Text style={{fontSize:10,color:C.blue,textTransform:"uppercase",letterSpacing:1}}>Current Location</Text>
              <Text style={{fontSize:14,fontWeight:"700",color:C.text,marginTop:2}}>
                {results.tracking.current_stop} → {results.tracking.next_stop}
              </Text>
              {results.tracking.eta_minutes && (
                <Text style={{fontSize:11,color:C.muted,marginTop:2}}>ETA: {results.tracking.eta_minutes} min</Text>
              )}
            </View>
          </View>
        )}
        <TouchableOpacity
          style={{padding:16,backgroundColor:C.danger,borderRadius:10,alignItems:"center"}}
          onPress={triggerSOS}>
          <Text style={{color:"#fff",fontSize:16,fontWeight:"800",letterSpacing:.5}}>🆘 PRESS SOS — SEND HELP</Text>
        </TouchableOpacity>
        <Text style={{fontSize:11,color:C.muted,textAlign:"center",marginTop:8}}>
          Sends your live location to police and emergency contacts
        </Text>
      </View>

    ) : (
      <>
        {/* Emergency alert + compact SIM SOS */}
        {(results.police_alert || results.safety_mode) && (
          <View style={[s.alertBanner, s.alertEm]}>
            <Text style={[s.alertText,{color:C.danger}]}>
              🚔 {results.police_alert||"Emergency mode active"}
            </Text>
          </View>
        )}
        {results.sim_tracking && results.police_alert && (
          <View style={s.simCard}>
            <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
              <View style={{flex:1}}>
                <Text style={{fontSize:12,fontWeight:"700",color:C.blue}}>📡 SIM Tracking Ready</Text>
                <Text style={{fontSize:11,color:C.muted,marginTop:2}}>Press SOS if you are in danger</Text>
              </View>
              <TouchableOpacity
                style={{backgroundColor:C.danger,borderRadius:8,paddingVertical:10,paddingHorizontal:16}}
                onPress={triggerSOS}>
                <Text style={{color:"#fff",fontSize:13,fontWeight:"800"}}>🆘 SOS</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Midnight */}
        {results.midnight_mode && (
          <View style={[s.alertBanner,{backgroundColor:"rgba(83,82,237,.1)",borderWidth:1,borderColor:"rgba(83,82,237,.4)"}]}>
            <Text style={[s.alertText,{color:C.purple}]}>🌙 Midnight mode — limited services after 10:30 PM</Text>
          </View>
        )}

        {/* Emergency message */}
        {results.emergency_message && (
          <View style={{backgroundColor:"rgba(255,71,87,.15)",borderWidth:1,borderColor:C.danger,borderRadius:10,padding:14,marginBottom:12,flexDirection:"row",alignItems:"center",gap:10}}>
            <Text style={{fontSize:20}}>🚨</Text>
            <View style={{flex:1}}>
              <Text style={{fontSize:13,fontWeight:"800",color:C.danger}}>{results.emergency_message}</Text>
              <Text style={{fontSize:11,color:C.muted,marginTop:3}}>Every minute matters — act now</Text>
            </View>
          </View>
        )}
       

       {/* Urgency label */}
{results.urgency_label && (
  <View style={{
    alignSelf:"flex-start",
    paddingVertical:4, paddingHorizontal:12,
    borderRadius:20, marginBottom:12,
    borderWidth:1,
    borderColor: results.urgency_label==="CRITICAL" ? C.danger
               : results.urgency_label==="URGENT"   ? C.warning : C.accent,
    backgroundColor: results.urgency_label==="CRITICAL" ? "rgba(255,71,87,.12)"
                   : results.urgency_label==="URGENT"   ? "rgba(255,165,2,.12)"
                   : "rgba(0,229,176,.12)"
  }}>
    <Text style={{
      fontSize:11, fontWeight:"800", letterSpacing:1,
      color: results.urgency_label==="CRITICAL" ? C.danger
           : results.urgency_label==="URGENT"   ? C.warning : C.accent
    }}>
      {results.urgency_label}
    </Text>
  </View>
)}

{/* Action steps */}
{results.action_steps?.length > 0 && (
  <View style={{backgroundColor:C.surface2,borderWidth:1,borderColor:C.border,borderRadius:12,padding:16,marginBottom:12}}>
    <Text style={{fontSize:10,color:C.accent,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>
      What to do right now
    </Text>
    {results.action_steps.map((step:string, i:number) => (
      <View key={i} style={{flexDirection:"row",gap:10,alignItems:"flex-start",marginBottom:8}}>
        <Text style={{color:C.accent,fontWeight:"700",flexShrink:0,fontSize:13}}>
          {step.split(".")[0]}.
        </Text>
        <Text style={{fontSize:13,color:C.text,flex:1}}>
          {step.split(".").slice(1).join(".").trim()}
        </Text>
      </View>
    ))}
  </View>
)}

{/* Backup route */}
{results.backup_route?.steps?.[0] && (() => {
  const b = results.backup_route.steps[0];
  return (
    <View style={{backgroundColor:C.surface,borderWidth:1,borderColor:C.border,borderLeftWidth:3,borderLeftColor:C.warning,borderRadius:12,padding:14,marginBottom:12}}>
      <Text style={{fontSize:10,color:C.warning,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
        Backup Option
      </Text>
      <View style={{flexDirection:"row",alignItems:"center",gap:8}}>
        <Text style={{fontSize:18}}>{TYPE_ICONS[b.type]||"🚗"}</Text>
        <View>
          <Text style={{fontSize:14,fontWeight:"700",color:C.text}}>{b.name}</Text>
          <Text style={{fontSize:12,color:C.muted}}>{b.time} · {b.booking_status} · {b.price_range||""}</Text>
        </View>
      </View>
      {b.booking_link && (
        <TouchableOpacity
          style={[s.bookBtn,{marginTop:10,borderColor:C.warning,backgroundColor:"rgba(255,165,2,.06)"}]}
          onPress={() => Linking.openURL(b.booking_link)}>
          <Text style={[s.bookBtnText,{color:C.warning}]}>Book Backup →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
})()}
        {/* Best action */}
        {results.best_action && (
          <View style={s.bestCard}>
            <Text style={s.bestLbl}>BEST ACTION RIGHT NOW</Text>
            <Text style={s.bestTxt}>{results.best_action}</Text>
            {results.reason
              && !results.police_alert && !results.safety_mode
              && !results.midnight_mode && !results.emergency_message
              && !results.best_action?.includes("No transport")
              && !results.best_action?.includes("🌙")
              && <Text style={s.bestSub}>💡 {results.reason}</Text>
            }
            {results.indirect_note && (
              <Text style={[s.bestSub,{color:C.purple}]}>🔄 {results.indirect_note}</Text>
            )}
            {results.confidence != null && (results.routes?.length > 0 || results.indirect_routes?.length > 0) && (
              <View style={{marginTop:10}}>
                <View style={s.confLabels}>
                  <Text style={s.confLabelText}>Confidence</Text>
                  <Text style={s.confLabelText}>{Math.round(results.confidence*100)}%</Text>
                </View>
                <View style={s.confTrack}>
                  <View style={[s.confFill,{width:`${Math.round(results.confidence*100)}%` as any}]}/>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Booking warnings */}
        {results.booking_warning && (
          <View style={[s.alertBanner,s.alertWarn]}>
            <Text style={[s.alertText,{color:C.warning}]}>{results.booking_warning}</Text>
          </View>
        )}
        {results.tatkal_suggestion && (
          <View style={[s.alertBanner,{backgroundColor:"rgba(83,82,237,.1)",borderWidth:1,borderColor:"rgba(83,82,237,.4)"}]}>
            <Text style={[s.alertText,{color:C.purple}]}>{results.tatkal_suggestion}</Text>
          </View>
        )}

        {/* Live tracking — no flights, no cab, positive ETA only */}
        {results.tracking?.current_stop
          && results.tracking?.eta_minutes > 0
          && results.tracking?.eta_minutes < 180
          && !results.sim_tracking && (
          <View style={s.trackCard}>
            <View style={s.trackDot}/>
            <View style={{flex:1}}>
              <Text style={s.trackLbl}>📍 LIVE TRACKING</Text>
              <Text style={s.trackStops}>{results.tracking.current_stop} → {results.tracking.next_stop}</Text>
              <Text style={s.trackEta}>
                ETA: {results.tracking.eta_minutes < 60
                  ? results.tracking.eta_minutes+" min"
                  : Math.round(results.tracking.eta_minutes/60)+"h "+(results.tracking.eta_minutes%60)+"m"}
              </Text>
            </View>
          </View>
        )}

        {/* Filters */}
        {(filteredRoutes.length > 0 || results.indirect_routes?.length > 0) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
            {["All","Train","Bus","Flight","Cab"].map(t => (
              <TouchableOpacity key={t}
                style={[s.filterBtn, filter===t && (
                  t==="All"    ? s.filterBtnActiveAll :
                  t==="Train"  ? s.filterBtnActiveTrain :
                  t==="Bus"    ? s.filterBtnActiveBus :
                  t==="Flight" ? s.filterBtnActiveFlight :
                                 s.filterBtnActiveCab
                )]}
                onPress={() => setFilter(t)}>
                <Text style={[s.filterBtnText, filter===t && {color: t==="All" ? "#000" : "#fff"}]}>
                  {t==="All" ? "All" : TYPE_ICONS[t]+" "+t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Direct routes */}
        {filteredRoutes.length > 0 && (
          <>
            <SectionTitle title="Direct Routes"/>
            {filteredRoutes.map((r:any, i:number) => <RouteCard key={i} route={r} isBest={i===0}/>)}
          </>
        )}

        {/* Indirect routes */}
        {results.indirect_routes?.length > 0 && (
          <>
            <SectionTitle title={filteredRoutes.length===0 ? "Best Connecting Routes" : "Connecting Routes"}/>
            {results.indirect_routes.map((r:any, i:number) => <IndirectCard key={i} route={r}/>)}
          </>
        )}

        {/* No routes fallback */}
        {filteredRoutes.length===0 && !results.indirect_routes?.length && (
          <>
            <View style={[s.alertBanner, s.alertWarn]}>
              <Text style={[s.alertText,{color:C.warning}]}>
                ⏳ {results.fallback || "No routes found right now."}
              </Text>
            </View>
            {results.cab_suggestion?.show && (
              <View style={{backgroundColor:"rgba(255,165,2,.08)",borderWidth:1,borderColor:"rgba(255,165,2,.3)",borderRadius:12,padding:16,marginBottom:12}}>
                <Text style={{fontSize:13,fontWeight:"700",color:C.warning,marginBottom:6}}>🚕 Emergency Cab Option</Text>
                <Text style={{fontSize:12,color:C.muted,marginBottom:10}}>{results.cab_suggestion.message}</Text>
                <TouchableOpacity style={[s.bookBtn,{borderColor:C.warning}]}
                  onPress={() => Linking.openURL(results.cab_suggestion.booking_link)}>
                  <Text style={[s.bookBtnText,{color:C.warning}]}>Book Cab Now →</Text>
                </TouchableOpacity>
              </View>
            )}
            {results.next_available?.map((n:any, i:number) => <NextAvailCard key={i} item={n}/>)}
          </>
        )}
      </>
    )}
  </View>
)}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={s.secTitle}>
      <Text style={s.secTitleText}>{title.toUpperCase()}</Text>
      <View style={s.secLine} />
    </View>
  );
}

function RouteCard({ route, isBest }: { route: any; isBest: boolean }) {
  const step = route.steps?.[0];
  if (!step) return null;

  const urgStr = step.urgency < 0    ? "Departed"
               : step.urgency < 60   ? step.urgency + " min"
               : step.urgency < 9999 ? Math.round(step.urgency/60) + "h " + (step.urgency%60) + "m"
               : "Anytime";

  const urgColor = step.urgency < 60 ? C.warning : step.urgency < 180 ? C.accent : C.text;


  return (
    <View style={[s.rcard, isBest && s.rcardBest]}>
      {/* Header */}
      <View style={s.rcardHdr}>
        <TypeBadge type={step.type} />
        <View style={{ flex: 1 }}>
          <Text style={s.rname}>{step.name}</Text>
          {step.number && <Text style={s.rnum}>#{step.number}</Text>}
        </View>
        {isBest && <Text style={s.bestStar}>★ BEST</Text>}
      </View>

      {step.type === "Flight" && step.airport_info && (
        <Text style={s.airportInfo}>✈️ {step.airport_info}</Text>
      )}

      {/* Meta */}
      <View style={s.rmeta}>
        <View>
          <Text style={s.ml}>Departs</Text>
          <Text style={[s.mv, { color: urgColor }]}>{step.time}</Text>
        </View>
        <View>
          <Text style={s.ml}>In</Text>
          <Text style={[s.mv, { color: urgColor }]}>{urgStr}</Text>
        </View>
        <View>
          <Text style={s.ml}>Duration</Text>
          <Text style={s.mv}>{Math.round(step.duration/60)}h {step.duration%60}m</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={s.rfoot}>
        <StatusPill status={step.booking_status} />
        {step.price_range && <Text style={s.priceTag}>{step.price_range}</Text>}
      </View>

      {step.live_status && (
        <Text style={s.liveRow}>
          🔴 {step.live_status} · {step.delay_prediction}
          {step.next_stop ? ` · Next: ${step.next_stop}` : ""}
        </Text>
      )}

      {step.booking_link && (
        <TouchableOpacity style={s.bookBtn} onPress={() => {
  Linking.canOpenURL(step.booking_link).then(supported => {
    if (supported) Linking.openURL(step.booking_link);
    else window.open(step.booking_link, '_blank');
  });
}}>
          <Text style={s.bookBtnText}>Book on {step.platform} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function IndirectCard({ route }: { route: any }) {
  const steps = route.steps || [];
  if (steps.length < 2) return null;

  return (
    <View style={[s.rcard, s.rcardIndirect]}>
      <Text style={s.indirectVia}>🔄 Connect via {route.via || "Mid-city"}</Text>
      {steps.map((step: any, i: number) => (
        <View key={i} style={s.istep}>
          <View style={s.istepHdr}>
            <View style={s.stepNum}>
              <Text style={s.stepNumText}>{i+1}</Text>
            </View>
            <TypeBadge type={step.type} small />
            <Text style={s.rname}>{step.name}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            <Text style={s.rnum}>🕐 {step.time}</Text>
            <Text style={s.rnum}>⏱ {Math.round(step.duration/60)}h {step.duration%60}m</Text>
            <Text style={s.rnum}>{step.booking_status}</Text>
          </View>
          {step.price_range && <Text style={s.rnum}>{step.price_range}</Text>}
          {step.booking_link && (
            <TouchableOpacity style={[s.bookBtn, { marginTop: 6 }]} onPress={() => {
  Linking.canOpenURL(step.booking_link).then(supported => {
    if (supported) Linking.openURL(step.booking_link);
    else window.open(step.booking_link, '_blank');
  });
}}>
              <Text style={s.bookBtnText}>Book →</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <Text style={s.rnum}>Confidence: {Math.round((route.confidence||0)*100)}%</Text>
    </View>
  );
}

function NextAvailCard({ item }: { item: any }) {
  return (
    <View style={s.ncard}>
      <Text style={s.rnum}>{item.type}</Text>
      <Text style={s.rname}>{item.name}</Text>
      <Text style={{ color: C.accent, fontSize: 12 }}>{item.time}{item.minutes_away ? ` (~${item.minutes_away}m)` : ""}</Text>
      {item.price_range && <Text style={s.rnum}>{item.price_range}</Text>}
      {item.booking_link && (
        <TouchableOpacity style={[s.bookBtn, { marginTop: 6 }]} onPress={() => Linking.openURL(item.booking_link)}>
          <Text style={s.bookBtnText}>Book →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function TypeBadge({ type, small }: { type: string; small?: boolean }) {
  const colors: Record<string,string> = {
    Train: C.train, Bus: C.bus, Cab: C.cab, Flight: C.flight
  };
  const color = colors[type] || C.muted;
  return (
    <View style={[s.tbadge, { borderColor: color + "55", backgroundColor: color + "22" }]}>
      <Text style={[s.tbadgeText, { color, fontSize: small ? 9 : 10 }]}>
        {TYPE_ICONS[type] || "🚗"} {type}
      </Text>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string,[string,string]> = {
    "Available":    [C.accent,   "rgba(0,229,176,.12)"],
    "Filling Fast": [C.warning,  "rgba(255,165,2,.12)"],
    "Waiting List": [C.danger,   "rgba(255,71,87,.12)"],
    "Sold Out":     [C.danger,   "rgba(255,71,87,.18)"],
  };
  const [color, bg] = map[status] || [C.muted, C.surface2];
  return (
    <View style={[s.spill, { backgroundColor: bg, borderColor: color + "44" }]}>
      <Text style={[s.spillText, { color }]}>{status}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { padding: 16, paddingBottom: 60, backgroundColor: C.bg },

  // Header
  header:      { flexDirection:"row", alignItems:"center", gap:12, marginBottom:24, paddingBottom:16, borderBottomWidth:1, borderBottomColor:C.border },
  logoBox:     { width:40, height:40, borderRadius:10, backgroundColor:C.purple, alignItems:"center", justifyContent:"center" },
  appTitle:    { fontSize:18, fontWeight:"800", color:C.text },
  appSub:      { fontSize:11, color:C.muted, marginTop:2 },
  liveDot:     { marginLeft:"auto" as any, flexDirection:"row", alignItems:"center", gap:5 },
  dotGreen:    { width:7, height:7, borderRadius:4, backgroundColor:C.accent },
  liveText:    { fontSize:11, color:C.accent },

  // Panel
  panel:       { backgroundColor:C.surface, borderWidth:1, borderColor:C.border, borderRadius:14, padding:18, marginBottom:14 },
  panelLabel:  { fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:1.5, marginBottom:12 },

  // Inputs
  inputRow:    { flexDirection:"row", alignItems:"center", gap:10, marginBottom:12 },
  inputWrap:   { flexDirection:"row", alignItems:"center", backgroundColor:C.surface2, borderWidth:1, borderColor:C.border, borderRadius:9, flex:1 },
  inputIcon:   { paddingLeft:10, fontSize:13 },
  input:       { flex:1, padding:11, color:C.text, fontSize:13 },
  arrow:       { color:C.accent, fontSize:16 },

  // Emergency
  emRow:       { flexDirection:"row", alignItems:"center", justifyContent:"space-between", padding:12, backgroundColor:C.surface2, borderRadius:9, borderWidth:1, borderColor:C.border, marginBottom:12 },
  emLabel:     { fontSize:13, fontWeight:"600", color:C.text },
  emergencyForm: { borderTopWidth:1, borderTopColor:C.border, paddingTop:14, marginBottom:12 },
  reasonGrid:  { flexDirection:"row", flexWrap:"wrap", gap:8, marginBottom:4 },
  reasonBtn:   { paddingVertical:9, paddingHorizontal:12, backgroundColor:C.surface2, borderWidth:1, borderColor:C.border, borderRadius:8 },
  reasonBtnActive: { borderColor:C.danger, backgroundColor:"rgba(255,71,87,.08)" },
  reasonBtnText:   { fontSize:12, fontWeight:"600", color:C.muted },
  smBtn:       { paddingVertical:10, paddingHorizontal:12, backgroundColor:C.surface2, borderWidth:1, borderColor:C.border, borderRadius:8 },
  smBtnText:   { fontSize:12, fontWeight:"700", color:C.text },
  otpDisplay:  { backgroundColor:"rgba(0,229,176,.08)", borderRadius:8, padding:9, marginBottom:10 },
  otpText:     { fontSize:13, color:C.accent },
  verifiedBadge: { fontSize:13, color:C.accent, marginBottom:10 },

  // Main button
  mainBtn:     { backgroundColor:C.accent, padding:14, borderRadius:10, alignItems:"center" },
  mainBtnText: { fontSize:14, fontWeight:"800", color:"#000" },

  // Alerts
  alertBanner: { borderRadius:10, padding:13, marginBottom:12 },
  alertEm:     { backgroundColor:"rgba(255,71,87,.1)", borderWidth:1, borderColor:"rgba(255,71,87,.4)" },
  alertWarn:   { backgroundColor:"rgba(255,165,2,.08)", borderWidth:1, borderColor:"rgba(255,165,2,.3)" },
  alertText:   { fontSize:13, fontWeight:"600" },

  // SIM card
  simCard:     { backgroundColor:"rgba(0,194,255,.07)", borderWidth:1, borderColor:"rgba(0,194,255,.3)", borderRadius:10, padding:12, marginBottom:12 },
  simText:     { fontSize:13, fontWeight:"600", color:C.blue },

  // Best card
  bestCard:    { backgroundColor:C.surface, borderWidth:1, borderColor:"rgba(0,229,176,.2)", borderRadius:12, padding:16, marginBottom:12 },
  bestLbl:     { fontSize:10, color:C.accent, textTransform:"uppercase", letterSpacing:1, marginBottom:5 },
  bestTxt:     { fontSize:16, fontWeight:"800", color:C.text, lineHeight:22 },
  bestSub:     { fontSize:12, color:C.muted, marginTop:5 },
  confLabels:  { flexDirection:"row", justifyContent:"space-between", marginBottom:4 },
  confLabelText: { fontSize:11, color:C.muted },
  confTrack:   { height:4, backgroundColor:C.surface2, borderRadius:2, overflow:"hidden" },
  confFill:    { height:4, backgroundColor:C.accent, borderRadius:2 },

  // Tracking
  trackCard:   { backgroundColor:C.surface2, borderWidth:1, borderColor:C.border, borderRadius:10, padding:13, marginBottom:12, flexDirection:"row", alignItems:"center", gap:12 },
  trackDot:    { width:10, height:10, borderRadius:5, backgroundColor:C.accent },
  trackLbl:    { fontSize:10, color:C.accent, textTransform:"uppercase", letterSpacing:1 },
  trackStops:  { fontSize:14, fontWeight:"700", color:C.text, marginTop:2 },
  trackEta:    { fontSize:11, color:C.muted, marginTop:2 },

  // Filters
  filterBtn:      { paddingVertical:6, paddingHorizontal:13, borderWidth:1, borderColor:C.border, borderRadius:20, marginRight:8, backgroundColor:"transparent" },
  filterBtnActiveAll:    { backgroundColor:C.text,   borderColor:C.text },
filterBtnActiveTrain:  { backgroundColor:C.train,  borderColor:C.train },
filterBtnActiveBus:    { backgroundColor:C.bus,    borderColor:C.bus },
filterBtnActiveFlight: { backgroundColor:C.flight, borderColor:C.flight },
filterBtnActiveCab:    { backgroundColor:C.cab,    borderColor:C.cab },
  filterBtnText:   { fontSize:12, fontWeight:"600", color:C.muted },

  // Section title
  secTitle:    { flexDirection:"row", alignItems:"center", gap:8, marginVertical:14 },
  secTitleText:{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:1.5 },
  secLine:     { flex:1, height:1, backgroundColor:C.border },

  // Route card
  rcard:       { backgroundColor:C.surface, borderWidth:1, borderColor:C.border, borderRadius:12, padding:15, marginBottom:9 },
  rcardBest:   { borderColor:"rgba(0,229,176,.3)" },
  rcardIndirect: { borderLeftWidth:3, borderLeftColor:C.purple },
  rcardHdr:    { flexDirection:"row", alignItems:"center", gap:9, marginBottom:10 },
  rname:       { fontSize:14, fontWeight:"700", color:C.text },
  rnum:        { fontSize:11, color:C.muted },
  bestStar:    { marginLeft:"auto" as any, fontSize:11, color:C.accent },
  airportInfo: { fontSize:11, color:C.blue, marginBottom:8 },
  rmeta:       { flexDirection:"row", justifyContent:"space-between", marginBottom:10 },
  ml:          { fontSize:10, color:C.muted },
  mv:          { fontSize:13, fontWeight:"600", color:C.text, marginTop:2 },
  rfoot:       { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingTop:9, borderTopWidth:1, borderTopColor:C.border },
  priceTag:    { fontSize:11, color:C.muted },
  liveRow:     { fontSize:11, color:C.muted, marginTop:7 },
  bookBtn:     { marginTop:9, padding:9, borderWidth:1, borderColor:C.accent, borderRadius:8, backgroundColor:"rgba(0,229,176,.06)", alignItems:"center" },
  bookBtnText: { fontSize:12, fontWeight:"700", color:C.accent },
  tbadge:      { paddingVertical:3, paddingHorizontal:8, borderRadius:20, borderWidth:1 },
  tbadgeText:  { fontWeight:"700" },
  spill:       { paddingVertical:3, paddingHorizontal:9, borderRadius:20, borderWidth:1 },
  spillText:   { fontSize:11, fontWeight:"600" },

  // Indirect
  indirectVia: { fontSize:11, color:C.purple, marginBottom:10 },
  istep:       { backgroundColor:C.surface2, borderRadius:8, padding:10, marginBottom:7 },
  istepHdr:    { flexDirection:"row", alignItems:"center", gap:7, marginBottom:4 },
  stepNum:     { width:18, height:18, borderRadius:9, backgroundColor:C.purple, alignItems:"center", justifyContent:"center" },
  stepNumText: { fontSize:10, fontWeight:"700", color:"#fff" },

  // Next avail
  ncard:       { backgroundColor:C.surface2, borderWidth:1, borderColor:C.border, borderRadius:9, padding:12, marginBottom:9 },

  // Error
  errCard:     { backgroundColor:"rgba(255,71,87,.07)", borderWidth:1, borderColor:"rgba(255,71,87,.3)", borderRadius:10, padding:16, alignItems:"center" },
  errIcon:     { fontSize:28, marginBottom:7 },
  errMsg:      { fontSize:14, fontWeight:"600", color:C.danger, textAlign:"center" },
});