Helping Hands – Emergency Travel Decision AI
Overview

Status: Proof of Concept · 2025–2026 

Role: Solo Product Builder & Engineer

Theme: Emergency travel decision-making under stress.

What if an app could tell you exactly what to do in an emergency — not just show you options?

Why This Exists

Most travel apps assume users have time to compare options.

In emergencies, people do not need choices—they need decisions.

Someone dealing with a medical emergency, accident, or family crisis shouldn't have to compare:

12 trains
8 buses
3 flights

while panicking.

The real question is:

"What should I do right now?"

Helping Hands was designed to answer that question.

The Core Product Decision

The hardest decision was:

Do not build another booking app.

Instead, build a:

Decision Engine

A comparison tool:

Options → User Decides

Helping Hands:

Recommendation → Explanation → Action
Decision Logic

The recommendation engine scores every route using:

Factor	Weight
Time Urgency	40
Seat Availability	30
Transport Reliability	25
Cost Penalty	Variable

Output:

One recommended route
Urgency label
Step-by-step action plan
Backup option
Designing Emergency Mode

Emergency Mode uses a completely different experience.

Normal Mode

Browse → Compare → Decide

Emergency Mode

Best Option → Backup → Action Steps

Abuse Prevention System

To prevent misuse:

Select emergency reason
Upload proof photo
AI photo verification
Aadhaar OTP verification (simulated)
Strike and cooldown system
Features and Why They Exist
📍 GPS Photo Stamping

Insight

Police documentation takes time.

Solution

Stamp GPS coordinates and timestamp directly onto accident photos.

🤖 AI Photo Verification

Insight

Users may upload unrelated photos.

Solution

Claude Vision validates emergency proof images.

🌙 Midnight Mode

Insight

Most direct services stop late at night.

Solution

Suggest indirect routes and early morning connections.

📡 SIM Tracking + SOS

Insight

Travel emergencies can continue after booking.

Solution

Provide live location tracking and emergency SOS flow.

🛡️ Anti-Abuse Strike System

Insight

Session-based rate limits are easy to bypass.

Solution

Track abuse by Aadhaar identity.

🎟️ Booking Simulation

Insight

Search results alone are not convincing.

Solution

End-to-end booking flow with PNR generation.

What Is Real vs Simulated
Implemented
Decision scoring engine
Emergency mode UX
Claude photo verification
GPS photo stamping
Aadhaar OTP simulation
Strike system
Midnight routing
Booking simulation
Demo scenarios
Production Requirements
IRCTC APIs
Flight APIs
Real-time seat availability
SMS gateway
UIDAI verification
Payment gateway
Emergency service integrations
What I Learned
Building a decision engine is different from building a list.

Every edge case requires deliberate product logic.

Reducing choices is a feature.

Emergency products should increase confidence, not options.

Honest prototypes matter.

Clear documentation of limitations demonstrates production thinking.

Credits
Development Assistance

Claude AI by Anthropic assisted with:

Code generation
Debugging
Architecture guidance
UI implementation
Product Direction

All product decisions, feature design, user flows, and business logic were independently designed by:

R S V K Jyothi

Status

🚧 Proof of Concept

Planned improvements:

Live travel APIs
Production authentication
Real emergency service integrations
Enhanced recommendation engine
Built By

R S V K Jyothi

Aspiring Product Manager · B.Tech 2026

Open to:

Product Management
Product Analyst
Business Analyst
Research Roles