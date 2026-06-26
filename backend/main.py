from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import pytz
import random
from datetime import datetime, timedelta
from typing import Optional

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def get_minutes(t):
    if t == "Anytime":
        return 9999
    dt = datetime.strptime(t, "%I:%M %p")
    return dt.hour * 60 + dt.minute

def minutes_until(dep_minutes, current_minutes):
    diff = dep_minutes - current_minutes
    if diff < -30:
        diff += 1440
    return diff

def get_emergency_advice(status, transport_type):
    if status == "Available":    return "Book immediately"
    if status == "Filling Fast": return "Hurry! Seats may sell out soon"
    if status == "Waiting List":
        if transport_type == "Train": return "Try Tatkal or General compartment"
        return "Check alternate buses or nearby city"
    if status == "Sold Out":     return "Try nearby stations or split journey"
    return "Check manually"

def get_realistic_status(time_left):
    return "Filling Fast" if time_left < 30 else "Available"

def get_live_status(urgency):
    if urgency < 30:  return "Arriving Soon"
    if urgency < 120: return "On Time"
    return "Delayed"

def predict_delay(urgency):
    if urgency < 30:  return "Low delay risk"
    if urgency < 120: return "Moderate delay risk"
    return "High delay risk"

# ─────────────────────────────────────────────
# SCORING
# ─────────────────────────────────────────────

def calculate_score(step):
    score   = 0
    urgency = step["urgency"]
    status  = step["booking_status"]
    t       = step["type"]

    if urgency <= 30:     score += 40
    elif urgency <= 120:  score += 30
    elif urgency <= 300:  score += 15
    elif urgency <= 360:  score += 5
    elif urgency == 9999: score += 8
    else:                 score -= 20

    if status == "Available":      score += 30
    elif status == "Filling Fast": score += 20
    elif status == "Waiting List": score += 5
    elif status == "Sold Out":     score -= 40

    score += {"Flight": 28, "Train": 25, "Bus": 10, "Cab": 5}.get(t, 5)
    score += {"Cab": -40, "Flight": -15, "Bus": 5, "Train": 0}.get(t, 0)

    if t == "Cab" and 0 < urgency < 60:  score += 15
    if t == "Cab" and urgency == 9999:   score -= 10

    return max(score, 1)

# ─────────────────────────────────────────────
# ABUSE PREVENTION
# ─────────────────────────────────────────────

aadhaar_records = {}
user_requests   = {}
pending_otps    = {}

def get_scaled_cooldown(strikes: int) -> int:
    return [10, 30, 120, 999][min(strikes, 3)]

def get_aadhaar_record(aadhaar: str, now: datetime) -> dict:
    if aadhaar not in aadhaar_records:
        aadhaar_records[aadhaar] = {
            "strikes": 0,
            "blocked_until": None,
            "emergency_count_today": 0,
            "last_reset": now,
            "last_emergency_time": None,
        }
    r = aadhaar_records[aadhaar]
    if r["last_reset"] and (now - r["last_reset"]) > timedelta(days=2):
        r["emergency_count_today"] = 0
        r["last_reset"] = now
    return r

def check_aadhaar_abuse(aadhaar: str, now: datetime):
    r = get_aadhaar_record(aadhaar, now)
    if r["strikes"] >= 3:
        return "PERMANENT_BLOCK", r
    if r["blocked_until"] and now < r["blocked_until"]:
        remaining = int((r["blocked_until"] - now).total_seconds() / 60)
        return f"BLOCKED:{remaining}", r
    if r["emergency_count_today"] >= 5:
        r["strikes"] += 1
        cooldown = get_scaled_cooldown(r["strikes"])
        r["blocked_until"] = now + timedelta(minutes=cooldown)
        return f"STRIKE:{r['strikes']}:{cooldown}", r
    last = r.get("last_emergency_time")
    cooldown_mins = get_scaled_cooldown(r["strikes"])
    if last and (now - last) < timedelta(minutes=cooldown_mins):
        remaining = cooldown_mins - int((now - last).total_seconds() / 60)
        return f"COOLDOWN:{remaining}", r
    return "OK", r

# ─────────────────────────────────────────────
# OTP SYSTEM
# ─────────────────────────────────────────────

def generate_otp(aadhaar: str) -> str:
    otp = str(random.randint(100000, 999999))
    tz  = pytz.timezone("Asia/Kolkata")
    pending_otps[aadhaar] = {
        "otp": otp,
        "expires_at": datetime.now(tz) + timedelta(minutes=5)
    }
    return otp

def verify_otp_code(aadhaar: str, otp_input: str) -> bool:
    tz     = pytz.timezone("Asia/Kolkata")
    now    = datetime.now(tz)
    record = pending_otps.get(aadhaar)
    if not record:                    return False
    if now > record["expires_at"]:
        del pending_otps[aadhaar];    return False
    if record["otp"] == otp_input.strip():
        del pending_otps[aadhaar];    return True
    return False

# ─────────────────────────────────────────────
# DEMO CONTROLLER
# ─────────────────────────────────────────────

def demo_controller(mode: str):
    if not mode or mode == "normal":
        return None
    if mode == "blocked":
        return {"error": "🚫 User blocked due to misuse", "reason": "Too many emergency requests. Strike 3 recorded."}
    if mode == "tracking":
        return {"tracking": {"current_stop": "Rajahmundry", "next_stop": "Vijayawada", "eta_minutes": 45}}
    if mode == "no_routes":
        return {
            "best_action": "🌙 No transport available at this hour",
            "reason": None,
            "routes": [],
            "indirect_routes": [],
            "cab_suggestion": {
                "show": True,
                "message": "🚕 Cab available but only suitable for short distances under 2 hours. For long distance, wait for early morning services from 6 AM.",
                "booking_link": "https://m.uber.com/ul/",
            },
            "fallback": "⏳ Next services start from 6 AM — plan accordingly",
            "next_available": [
                {"type": "Train",  "name": "Intercity Express", "time": "06:00 AM", "minutes_away": 390, "booking_link": "https://www.irctc.co.in",      "price_range": "₹200–₹800"},
                {"type": "Flight", "name": "IndiGo 6E-384",     "time": "06:15 AM", "minutes_away": 405, "booking_link": "https://www.goindigo.in",       "price_range": "₹2,500–₹6,000"},
                {"type": "Bus",    "name": "APSRTC Volvo AC",    "time": "12:30 AM", "minutes_away": 60,  "booking_link": "https://www.apsrtconline.in",   "price_range": "₹180–₹280"},
                {"type": "Cab",    "name": "Emergency Cab",      "time": "Now",                           "booking_link": "https://m.uber.com/ul/",         "price_range": "₹1,200–₹3,500"},
            ]
        }
    if mode == "sim_tracking":
        return {
            "best_action":  "📡 SIM Tracking Active",
            "sim_tracking": "📡 SIM location is being tracked and shared with emergency contact",
            "tracking":     {"current_stop": "Vijayawada", "next_stop": "Khammam", "eta_minutes": 30}
        }
    if mode == "midnight":
        midnight_minutes = 23 * 60 + 45
        direct_mid = []
        for item in transport_data:
            dep = get_minutes(item["time"])
            time_left = minutes_until(dep, midnight_minutes)
            if item["time"] != "Anytime" and time_left < -30:
                continue
            dep_hour = dep // 60
            if item["time"] != "Anytime" and not (dep_hour >= 22 or dep_hour <= 7):
                continue
            status_live = get_realistic_status(time_left)
            step = {**item, "booking_status": status_live, "urgency": time_left,
                    "live_status": get_live_status(time_left),
                    "delay_prediction": predict_delay(time_left),
                    "next_stop": item["stops"][1] if len(item["stops"]) > 1 else "Direct",
                    "advice": get_emergency_advice(status_live, item["type"])}
            score = calculate_score(step)
            direct_mid.append({"route": "direct", "steps": [step],
                                "arrival": dep + item["duration"],
                                "score": score,
                                "confidence": round(min(score / 100, 1.0), 2)})
        direct_mid.sort(key=lambda x: x["score"], reverse=True)
        if direct_mid:
            best = direct_mid[0]["steps"][0]
            return {
                "best_action": f"🌙 Late night — {best['type']} {best['name']} is your only option",
                "midnight_mode": True,
                "reason": None,
                "confidence": direct_mid[0]["confidence"],
                "routes": direct_mid[:3],
                "indirect_routes": [],
                "fallback": "⏳ Very limited services after 10:30 PM"
            }
        else:
            return {
                "best_action": "🌙 No transport after 10:30 PM",
                "midnight_mode": True,
                "reason": None,
                "routes": [],
                "indirect_routes": [],
                "cab_suggestion": {
                    "show": True,
                    "message": "🚕 Only cabs available at this hour. Next train/bus from 6 AM.",
                    "booking_link": "https://m.uber.com/ul/",
                },
                "fallback": "⏳ Next services start from 6 AM",
                "next_available": [
                    {"type": "Train",  "name": "Intercity Express", "time": "06:00 AM", "minutes_away": 375, "booking_link": "https://www.irctc.co.in",  "price_range": "₹200–₹800"},
                    {"type": "Flight", "name": "IndiGo 6E-384",     "time": "06:15 AM", "minutes_away": 390, "booking_link": "https://www.goindigo.in",  "price_range": "₹2,500–₹6,000"},
                ]
            }
    return None

# ─────────────────────────────────────────────
# TRANSPORT DATA
# ─────────────────────────────────────────────

transport_data = [
    # TRAINS
    {"type":"Train","name":"Godavari Express","number":"12727",
     "source":"Rajahmundry","destination":"Hyderabad","time":"09:30 PM","duration":420,
     "platform":"IRCTC","booking_link":"https://www.irctc.co.in/nget/train-search?fromStation=RJY&toStation=HYB",
     "booking_status":"Filling Fast","price_range":"₹350–₹1200",
     "stops":["Rajahmundry Station","Kovvur","Nidadavolu","Tadepalligudem","Eluru",
              "Vijayawada Junction","Khammam","Warangal","Kazipet","Secunderabad","Hyderabad"]},

    {"type":"Train","name":"Charminar Express","number":"12759",
     "source":"Vijayawada","destination":"Hyderabad","time":"08:45 PM","duration":330,
     "platform":"IRCTC","booking_link":"https://www.irctc.co.in/nget/train-search?fromStation=BZA&toStation=HYB",
     "booking_status":"Waiting List","price_range":"₹250–₹900",
     "stops":["Vijayawada Junction","Madhira","Khammam","Warangal","Kazipet","Secunderabad","Hyderabad"]},

    {"type":"Train","name":"Intercity Express","number":"57257",
     "source":"Vijayawada","destination":"Hyderabad","time":"06:00 AM","duration":360,
     "platform":"IRCTC","booking_link":"https://www.irctc.co.in/nget/train-search?fromStation=BZA&toStation=HYB",
     "booking_status":"Available","price_range":"₹200–₹800",
     "stops":["Vijayawada Junction","Eluru","Khammam","Suryapet","Nalgonda","Secunderabad","Hyderabad"]},

    {"type":"Train","name":"Rajahmundry Passenger","number":"57478",
     "source":"Rajahmundry","destination":"Vijayawada","time":"11:45 PM","duration":180,
     "platform":"IRCTC","booking_link":"https://www.irctc.co.in/nget/train-search?fromStation=RJY&toStation=BZA",
     "booking_status":"Available","price_range":"₹80–₹300",
     "stops":["Rajahmundry Station","Kovvur","Eluru","Bhimavaram","Vijayawada Junction"]},

    # BUSES
    {"type":"Bus","name":"APSRTC Express",
     "source":"Rajahmundry","destination":"Hyderabad","time":"10:00 PM","duration":480,
     "platform":"RedBus","booking_link":"https://www.redbus.in/bus-tickets/rajahmundry-to-hyderabad",
     "booking_status":"Available","price_range":"₹450–₹700",
     "stops":["Rajahmundry","Kadiyam","Eluru","Vijayawada","Suryapet","LB Nagar","Dilsukhnagar","Hyderabad"]},

    {"type":"Bus","name":"Night Super Luxury",
     "source":"Vijayawada","destination":"Hyderabad","time":"11:30 PM","duration":300,
     "platform":"APSRTC","booking_link":"https://www.apsrtconline.in",
     "booking_status":"Available","price_range":"₹500–₹750",
     "stops":["Vijayawada","Guntur","Suryapet","LB Nagar","Hyderabad"]},

    {"type":"Bus","name":"APSRTC Volvo AC",
     "source":"Rajahmundry","destination":"Vijayawada","time":"12:30 AM","duration":150,
     "platform":"APSRTC","booking_link":"https://www.apsrtconline.in",
     "booking_status":"Available","price_range":"₹180–₹280",
     "stops":["Rajahmundry","Kovvur","Eluru","Vijayawada"]},

    # FLIGHTS
    {"type":"Flight","name":"IndiGo 6E-384",
     "source":"Rajahmundry","destination":"Hyderabad","time":"06:15 AM","duration":55,
     "platform":"IndiGo","booking_link":"https://www.goindigo.in/flight-booking.html",
     "booking_status":"Available","price_range":"₹2,500–₹6,000",
     "airport_info":"Rajahmundry Airport (RJA) → Rajiv Gandhi Intl (HYD)",
     "stops":["Rajahmundry Airport","Hyderabad Airport"]},

    {"type":"Flight","name":"Air India AI-541",
     "source":"Rajahmundry","destination":"Hyderabad","time":"12:10 PM","duration":60,
     "platform":"Air India","booking_link":"https://www.airindia.in/book-flights.htm",
     "booking_status":"Available","price_range":"₹3,000–₹8,000",
     "airport_info":"Rajahmundry Airport (RJA) → Rajiv Gandhi Intl (HYD)",
     "stops":["Rajahmundry Airport","Hyderabad Airport"]},

    {"type":"Flight","name":"IndiGo 6E-516",
     "source":"Vijayawada","destination":"Hyderabad","time":"07:30 AM","duration":50,
     "platform":"IndiGo","booking_link":"https://www.goindigo.in/flight-booking.html",
     "booking_status":"Filling Fast","price_range":"₹2,000–₹5,500",
     "airport_info":"Vijayawada Airport (VGA) → Rajiv Gandhi Intl (HYD)",
     "stops":["Vijayawada Airport","Hyderabad Airport"]},

    {"type":"Flight","name":"SpiceJet SG-8782",
     "source":"Vijayawada","destination":"Hyderabad","time":"03:45 PM","duration":55,
     "platform":"SpiceJet","booking_link":"https://www.spicejet.com",
     "booking_status":"Available","price_range":"₹1,800–₹4,500",
     "airport_info":"Vijayawada Airport (VGA) → Rajiv Gandhi Intl (HYD)",
     "stops":["Vijayawada Airport","Hyderabad Airport"]},

    # CAB
    {"type":"Cab","name":"Emergency Cab",
     "source":"Any","destination":"Any","time":"Anytime","duration":360,
     "platform":"Uber/Ola","booking_link":"https://m.uber.com/ul/",
     "booking_status":"Available","price_range":"₹1,200–₹3,500",
     "stops":["Door Pickup","Direct Drop"]},
]

# ─────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────

app = FastAPI(title="Helping Hands API", version="3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

try:
    app.mount("/static", StaticFiles(directory="static"), name="static")
    @app.get("/app")
    def serve_app():
        return FileResponse("static/index.html")
except Exception:
    pass

@app.get("/")
def home():
    return {"message": "Helping Hands API v3.0", "status": "ok"}

@app.post("/request-otp")
def request_otp(aadhaar: str):
    if len(aadhaar) != 12 or not aadhaar.isdigit():
        return {"error": "Invalid Aadhaar. Must be 12 digits."}
    otp = generate_otp(aadhaar)
    return {"message": "OTP sent (simulated)", "otp": otp, "expires_in": "5 minutes"}

@app.post("/verify-otp")
def verify_otp_endpoint(aadhaar: str, otp: str):
    if len(aadhaar) != 12 or not aadhaar.isdigit():
        return {"error": "Invalid Aadhaar number"}
    if verify_otp_code(aadhaar, otp):
        return {"verified": True}
    return {"verified": False, "error": "Invalid or expired OTP"}

# ─────────────────────────────────────────────
# CITY MATCHING
# ─────────────────────────────────────────────

def match_city(u: str, d: str) -> bool:
    return u.lower().strip() in d.lower().strip() or d.lower().strip() in u.lower().strip()

def route_serves(item, src, dst):
    sm = (item["source"] == "Any"
          or match_city(src, item["source"])
          or any(match_city(src, s) for s in item.get("stops", [])))
    dm = (item["destination"] == "Any"
          or match_city(dst, item["destination"])
          or any(match_city(dst, s) for s in item.get("stops", [])))
    return sm and dm

# ─────────────────────────────────────────────
# EMERGENCY MODE SEARCH
# ─────────────────────────────────────────────

def emergency_search(src, dst, current_minutes, demo_data):
    cab_option = next((i for i in transport_data if i["type"] == "Cab"), None)
    cab_fallback = {
        "show": True,
        "message": "🚕 Cab as last resort — local distances only (under 2 hours)",
        "booking_link": cab_option["booking_link"] if cab_option else "https://m.uber.com/ul/"
    }

    # Step 1: Best single direct option
    best_emergency = None
    best_score     = -999

    for item in transport_data:
        if not route_serves(item, src, dst): continue
        if item["type"] == "Cab": continue
        dep       = get_minutes(item["time"])
        time_left = minutes_until(dep, current_minutes)
        if time_left < -30 or time_left > 480: continue
        status_live = get_realistic_status(time_left)
        if status_live not in ["Available", "Filling Fast"]: continue
        step = {
            **item,
            "booking_status":   status_live,
            "urgency":          time_left,
            "live_status":      get_live_status(time_left),
            "delay_prediction": predict_delay(time_left),
            "next_stop":        item["stops"][1] if len(item["stops"]) > 1 else "Direct",
            "advice":           get_emergency_advice(status_live, item["type"])
        }
        score = calculate_score(step)
        if score > best_score:
            best_score     = score
            best_emergency = step

    # Step 2: One backup — different type
    backup_emergency = None
    backup_score     = -999

    for item in transport_data:
        if not route_serves(item, src, dst): continue
        if item["type"] == "Cab": continue
        if best_emergency and item["type"] == best_emergency["type"]: continue
        dep       = get_minutes(item["time"])
        time_left = minutes_until(dep, current_minutes)
        if time_left < -30 or time_left > 480: continue
        status_live = get_realistic_status(time_left)
        if status_live not in ["Available", "Filling Fast"]: continue
        step = {
            **item,
            "booking_status":   status_live,
            "urgency":          time_left,
            "live_status":      get_live_status(time_left),
            "delay_prediction": predict_delay(time_left),
            "next_stop":        item["stops"][1] if len(item["stops"]) > 1 else "Direct",
            "advice":           get_emergency_advice(status_live, item["type"])
        }
        score = calculate_score(step)
        if score > backup_score:
            backup_score     = score
            backup_emergency = step

    # Step 3: One indirect if no direct
    indirect_emergency = []
    for first in transport_data:
        if first["source"] == "Any": continue
        if not match_city(src, first["source"]): continue
        dep1 = get_minutes(first["time"])
        urg1 = minutes_until(dep1, current_minutes)
        if urg1 < -30 or urg1 > 480: continue
        s1 = get_realistic_status(urg1)
        if s1 not in ["Available", "Filling Fast"]: continue

        for second in transport_data:
            if second["destination"] == "Any": continue
            if not match_city(first["destination"].lower(), second["source"]): continue
            if not match_city(dst, second["destination"]): continue
            if first["name"] == second["name"]: continue
            if match_city(src, second["destination"]): continue
            if match_city(dst, first["destination"]): continue

            dep2     = get_minutes(second["time"])
            urg2     = minutes_until(dep2, current_minutes)
            arr1     = (dep1 + first["duration"]) % 1440
            dep2_adj = dep2 if dep2 >= arr1 else dep2 + 1440
            if dep2_adj < arr1 + 30: continue

            s2 = get_realistic_status(urg2)
            if s2 not in ["Available", "Filling Fast"]: continue

            score = calculate_score({
                "urgency": urg1, "booking_status": s1, "type": first["type"]
            })
            indirect_emergency.append({
                "route": "indirect",
                "via":   first["destination"],
                "steps": [
                    {**first,  "booking_status": s1, "urgency": urg1,
                     "live_status": get_live_status(urg1),
                     "delay_prediction": predict_delay(urg1),
                     "advice": get_emergency_advice(s1, first["type"]),
                     "next_stop": first["stops"][1] if len(first["stops"]) > 1 else "Direct"},
                    {**second, "booking_status": s2, "urgency": urg2,
                     "live_status": get_live_status(urg2),
                     "delay_prediction": predict_delay(urg2),
                     "advice": get_emergency_advice(s2, second["type"]),
                     "next_stop": second["stops"][1] if len(second["stops"]) > 1 else "Direct"}
                ],
                "arrival":    dep2 + second["duration"],
                "score":      score,
                "confidence": round(min(score / 100, 1.0), 2)
            })

    indirect_emergency.sort(key=lambda x: x["score"], reverse=True)

    # Step 4: Build response
    if best_emergency:
        urgency_mins = best_emergency["urgency"]
        if urgency_mins < 30:
            action_text   = f"🚨 Leave NOW — {best_emergency['type']} {best_emergency['name']} departs in {urgency_mins} min"
            urgency_label = "CRITICAL"
        elif urgency_mins < 120:
            action_text   = f"⚡ Book immediately — {best_emergency['type']} {best_emergency['name']} in {urgency_mins} min"
            urgency_label = "URGENT"
        else:
            hrs  = urgency_mins // 60
            mins = urgency_mins % 60
            action_text   = f"📋 Book now — {best_emergency['type']} {best_emergency['name']} in {hrs}h {mins}m"
            urgency_label = "MODERATE"

        if urgency_mins < 60:
            steps_list = [
                f"1. Head to {best_emergency['stops'][0]} immediately",
                f"2. Book on {best_emergency['platform']} right now",
                f"3. Backup: {backup_emergency['type']} {backup_emergency['name']} at {backup_emergency['time']}"
                    if backup_emergency else "3. Call a cab if this is missed"
            ]
        else:
            steps_list = [
                f"1. Book {best_emergency['type']} {best_emergency['name']} now to secure seat",
                f"2. Departs {best_emergency['time']} from {best_emergency['stops'][0]}",
                f"3. Backup: {backup_emergency['type']} {backup_emergency['name']}"
                    if backup_emergency else "3. Cab available as fallback"
            ]

        show_tracking = (
            0 < best_emergency["urgency"] < 180
            and best_emergency["type"] not in ["Flight", "Cab"]
        )

        response = {
            "best_action":      action_text,
            "urgency_label":    urgency_label,
            "action_steps":     steps_list,
            "reason":           None,
            "emergency_message":"🚨 Emergency route selected — fastest available option",
            "confidence":       round(min(best_score / 100, 1.0), 2),
            "police_alert":     "🚔 Emergency mode active — authorities can be notified",
            "safety_mode":      True,
            "sim_tracking":     "📡 SIM tracking ready — press SOS if needed",
            "tracking": {
                "current_stop": best_emergency["stops"][0],
                "next_stop":    best_emergency["stops"][1] if len(best_emergency["stops"]) > 1 else "Final",
                "eta_minutes":  best_emergency["urgency"]
            } if show_tracking else None,
            "routes": [{"route": "direct", "steps": [best_emergency],
                        "score": best_score,
                        "confidence": round(min(best_score / 100, 1.0), 2)}],
            "backup_route":    {"steps": [backup_emergency]} if backup_emergency else None,
            "indirect_routes": indirect_emergency[:1],
            "cab_suggestion":  cab_fallback
        }

    elif indirect_emergency:
        s_steps = indirect_emergency[0]["steps"]
        response = {
            "best_action":      f"🔄 No direct route — go via {indirect_emergency[0]['via']} immediately",
            "urgency_label":    "URGENT",
            "action_steps": [
                f"1. Take {s_steps[0]['type']} {s_steps[0]['name']} to {indirect_emergency[0]['via']}",
                f"2. Connect to {s_steps[1]['type']} {s_steps[1]['name']} from there",
                "3. Book both legs now to secure seats"
            ],
            "reason":           None,
            "emergency_message":"🚨 No direct routes — fastest connecting route activated",
            "confidence":       indirect_emergency[0]["confidence"],
            "police_alert":     "🚔 Emergency mode active",
            "safety_mode":      True,
            "sim_tracking":     "📡 SIM tracking ready — press SOS if needed",
            "routes":           [],
            "indirect_routes":  indirect_emergency[:2],
            "cab_suggestion":   cab_fallback
        }

    else:
        response = {
            "best_action":      "🚕 No transport available — book emergency cab now",
            "urgency_label":    "CRITICAL",
            "action_steps": [
                "1. Book Uber/Ola immediately",
                "2. Note: cab suitable for short distances only",
                "3. Check early morning trains from 6 AM"
            ],
            "reason":           None,
            "emergency_message":"🚨 No scheduled transport — cab is your only option",
            "confidence":       0.3,
            "police_alert":     "🚔 Emergency mode active",
            "safety_mode":      True,
            "sim_tracking":     "📡 SIM tracking ready — press SOS if needed",
            "routes":           [],
            "indirect_routes":  [],
            "cab_suggestion": {
                "show":    True,
                "message": "🚕 Book cab immediately for short distances. For long distance, wait for 6 AM services.",
                "booking_link": cab_option["booking_link"] if cab_option else "https://m.uber.com/ul/"
            },
            "next_available": _next_available(src, dst, current_minutes)
        }

    if demo_data:
        if "error" in demo_data: return demo_data
        for k, v in demo_data.items():
            response[k] = v

    return response

# ─────────────────────────────────────────────
# NORMAL MODE SEARCH
# ─────────────────────────────────────────────

def normal_search(src, dst, current_minutes, demo_data):
    cab_option  = next((i for i in transport_data if i["type"] == "Cab"), None)
    cab_fallback = {
        "show":    True,
        "message": "🚕 Emergency cab available for short distances only (under 2 hours).",
        "booking_link": cab_option["booking_link"] if cab_option else "https://m.uber.com/ul/"
    } if cab_option else None

    direct   = []
    indirect = []

    # Direct routes
    for item in transport_data:
        if not route_serves(item, src, dst): continue
        if item["type"] == "Cab" and item["time"] == "Anytime": continue
        dep       = get_minutes(item["time"])
        time_left = minutes_until(dep, current_minutes)
        if item["time"] != "Anytime" and time_left < -30: continue
        status_live = get_realistic_status(time_left)
        step = {
            **item,
            "booking_status":   status_live,
            "urgency":          time_left,
            "live_status":      get_live_status(time_left),
            "delay_prediction": predict_delay(time_left),
            "next_stop":        item["stops"][1] if len(item["stops"]) > 1 else "Direct",
            "advice":           get_emergency_advice(status_live, item["type"])
        }
        score = calculate_score(step)
        direct.append({"route": "direct", "steps": [step],
                        "arrival": dep + item["duration"],
                        "score": score,
                        "confidence": round(min(score / 100, 1.0), 2)})

    # Indirect routes
    for first in transport_data:
        if first["source"] == "Any": continue
        if not match_city(src, first["source"]) and not any(match_city(src, s) for s in first.get("stops", [])): continue
        for second in transport_data:
            if second["destination"] == "Any": continue
            mid = first["destination"].lower()
            if not match_city(mid, second["source"]) and not any(match_city(mid, s) for s in second.get("stops", [])): continue
            if not match_city(dst, second["destination"]) and not any(match_city(dst, s) for s in second.get("stops", [])): continue
            if first["name"] == second["name"]: continue
            if match_city(src, second["destination"]): continue
            if match_city(dst, first["destination"]): continue

            dep1     = get_minutes(first["time"])
            dep2     = get_minutes(second["time"])
            urg1     = minutes_until(dep1, current_minutes)
            urg2     = minutes_until(dep2, current_minutes)
            if first["time"] != "Anytime" and urg1 < -30: continue
            arr1     = (dep1 + first["duration"]) % 1440
            if second["time"] != "Anytime":
                dep2_adj = dep2 if dep2 >= arr1 else dep2 + 1440
                if dep2_adj < arr1 + 30: continue
            s1    = get_realistic_status(urg1)
            s2    = get_realistic_status(urg2)
            score = calculate_score({"urgency": urg1, "booking_status": s1, "type": first["type"]})
            indirect.append({
                "route": "indirect",
                "via":   first["destination"],
                "steps": [
                    {**first,  "booking_status": s1, "urgency": urg1,
                     "live_status": get_live_status(urg1),
                     "delay_prediction": predict_delay(urg1),
                     "advice": get_emergency_advice(s1, first["type"]),
                     "next_stop": first["stops"][1] if len(first["stops"]) > 1 else "Direct"},
                    {**second, "booking_status": s2, "urgency": urg2,
                     "live_status": get_live_status(urg2),
                     "delay_prediction": predict_delay(urg2),
                     "advice": get_emergency_advice(s2, second["type"]),
                     "next_stop": second["stops"][1] if len(second["stops"]) > 1 else "Direct"}
                ],
                "arrival":    dep2 + second["duration"],
                "score":      score,
                "confidence": round(min(score / 100, 1.0), 2)
            })

    direct.sort(key=lambda x: x["score"],   reverse=True)
    indirect.sort(key=lambda x: x["score"], reverse=True)

    # Booking warnings
    booking_warning    = None
    tatkal_suggestion  = None
    if direct:
        best_status = direct[0]["steps"][0]["booking_status"]
        best_type   = direct[0]["steps"][0]["type"]
        if best_status == "Waiting List":
            booking_warning = "⚠️ Best option is on Waiting List — confirmation not guaranteed"
            if best_type == "Train":
                tatkal_suggestion = "💡 Try Tatkal quota (opens 1 day before) or check General compartment at station"
        elif best_status == "Filling Fast":
            booking_warning = "⚠️ Seats filling fast — book within next 10 minutes"

    # Build response
    if not direct and not indirect:
        response = {
            "best_action":  "🌙 No transport available right now",
            "reason":       None,
            "routes":       [],
            "indirect_routes": [],
            "cab_suggestion": cab_fallback,
            "fallback":     "⏳ Next services start from 6 AM — plan accordingly",
            "next_available": _next_available(src, dst, current_minutes)
        }
    elif direct:
        best         = direct[0]["steps"][0]
        show_tracking = 0 < best["urgency"] < 180 and best["type"] not in ["Flight", "Cab"]
        response = {
            "best_action":     f"{best['type']} {best['name']} is your best option",
            "reason":          best["advice"],
            "confidence":      direct[0]["confidence"],
            "booking_warning": booking_warning,
            "tatkal_suggestion": tatkal_suggestion,
            "tracking": {
                "current_stop": best["stops"][0],
                "next_stop":    best["stops"][1] if len(best["stops"]) > 1 else "Final",
                "eta_minutes":  best["urgency"]
            } if show_tracking else None,
            "routes":          direct[:5],
            "indirect_routes": indirect[:3],
            "cab_suggestion":  cab_fallback
        }
    else:
        s_steps  = indirect[0]["steps"]
        response = {
            "best_action":  f"🔄 No direct routes — go via {indirect[0]['via']}",
            "reason":       None,
            "confidence":   indirect[0]["confidence"],
            "indirect_note": f"Take {s_steps[0]['type']} {s_steps[0]['name']} to {indirect[0]['via']}, then {s_steps[1]['type']} {s_steps[1]['name']}",
            "routes":        [],
            "indirect_routes": indirect[:5],
            "cab_suggestion":  cab_fallback
        }

    if demo_data:
        if "error" in demo_data: return demo_data
        for k, v in demo_data.items():
            response[k] = v

    return response

# ─────────────────────────────────────────────
# MAIN SEARCH ENDPOINT
# ─────────────────────────────────────────────

@app.get("/search")
def search(
    source:           str,
    destination:      str,
    emergency:        bool = False,
    emergency_reason: str  = "none",
    aadhaar:          Optional[str] = None,
    otp_verified:     bool = False,
    has_photo:        bool = False,
    user_id:          str  = "anonymous",
    demo:             str  = None
):
    tz  = pytz.timezone("Asia/Kolkata")
    now = datetime.now(tz)
    current_minutes = now.hour * 60 + now.minute

    demo_data = demo_controller(demo)

    # Emergency gate
    if emergency:
        valid_reasons = ["medical", "accident", "family"]
        if emergency_reason.lower() not in valid_reasons:
            return {"error": "Select a valid emergency reason", "valid_reasons": valid_reasons}
        if not aadhaar:
            return {"error": "Aadhaar number required for emergency mode"}
        if len(aadhaar) != 12 or not aadhaar.isdigit():
            return {"error": "Invalid Aadhaar. Must be 12 digits."}
        if not otp_verified:
            return {"error": "OTP verification required before emergency search"}

        abuse_status, record = check_aadhaar_abuse(aadhaar, now)
        if abuse_status == "PERMANENT_BLOCK":
            return {"error": "🚫 Permanently blocked. Contact support."}
        if abuse_status.startswith("BLOCKED:"):
            return {"error": f"⏳ Blocked. Try again in {abuse_status.split(':')[1]} minutes."}
        if abuse_status.startswith("COOLDOWN:"):
            return {"error": f"⏳ Cooldown active. Try again in {abuse_status.split(':')[1]} minutes."}
        if abuse_status.startswith("STRIKE:"):
            parts = abuse_status.split(":")
            return {"error": f"⚠️ Strike {parts[1]} recorded. Blocked for {parts[2]} minutes."}

        record["emergency_count_today"] += 1
        record["last_emergency_time"]    = now
        aadhaar_records[aadhaar]         = record

    # Session rate limit
    if user_id not in user_requests:
        user_requests[user_id] = []
    user_requests[user_id] = [t for t in user_requests[user_id] if now - t < timedelta(minutes=5)]
    user_requests[user_id].append(now)
    if len(user_requests[user_id]) > 15:
        return {"error": "Too many requests. Wait a few minutes."}

    src = source.strip().lower()
    dst = destination.strip().lower()

    # Route to correct mode
    if emergency:
        return emergency_search(src, dst, current_minutes, demo_data)
    else:
        return normal_search(src, dst, current_minutes, demo_data)


# ─────────────────────────────────────────────
# NEXT AVAILABLE HELPER
# ─────────────────────────────────────────────

def _next_available(src, dst, current_minutes):
    opts = []
    for item in transport_data:
        if not route_serves(item, src, dst): continue
        if item["time"] == "Anytime":
            opts.append({"type": item["type"], "name": item["name"], "time": "Now",
                         "booking_link": item["booking_link"], "price_range": item.get("price_range", "—")})
            continue
        dep  = get_minutes(item["time"])
        mins = minutes_until(dep, current_minutes)
        if 0 < mins < 600:
            opts.append({"type": item["type"], "name": item["name"], "time": item["time"],
                         "minutes_away": mins, "booking_link": item["booking_link"],
                         "price_range": item.get("price_range", "—")})
    opts.sort(key=lambda x: x.get("minutes_away", 9999))
    return opts[:4]