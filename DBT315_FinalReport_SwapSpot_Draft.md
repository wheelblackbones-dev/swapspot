# DBT315 Final Project Report

## SwapSpot: Voice-First Parking Finder

**Written Group Platform Dossier — Draft from the current project**

| Report information | Detail |
|---|---|
| Course | DBT315 Platform Design, Thammasat University |
| Project | SwapSpot |
| Group |  |
| Team members and student IDs |  |
| Submission date |  |

> **About this draft:** This report uses plain language and describes only what can be seen in the current project files. The app is a demonstration. It does not show real parking availability, make reservations, take payments, or provide driving directions. Details that are not in the project have been left blank instead of guessed.

## Executive Summary

SwapSpot is a parking-finder demonstration for people looking for parking. It shows 16 sample parking places in central Bangkok. A visitor can ask for parking by speaking or typing, compare prices and features, look at a map, and open sample screens for parking spaces, a route, or a camera.

The current version is a demonstration, not a live parking marketplace. The parking details are sample information, the number of open spaces changes on the screen as a simulation, and choosing a space does not reserve it. The route and camera views are also simulated. The project does not show a live connection with parking operators, a supplier sign-up process, real customer research, real payments, or a record of sales.

The project files show what the visitor can do, but do not provide evidence about whether drivers want the service, whether parking operators would join, how much either side would pay, or whether the business could earn more than it costs. Those details are left blank in this draft.

# Chapter 1: The Problem, First Customers, and Project Changes

## 1.1 The Problem and First Market

The project presents a service for finding parking places. It lets a visitor search by area, price, distance, and features such as covered parking, electric-car charging, or accessible spaces. Its sample parking places are located around central Bangkok.

The project files do not include interviews, surveys, market research, or test results proving that this is a problem people will pay to solve. The exact first customer group and the size of the market are therefore:

| Question | Detail |
|---|---|
| First group of customers to serve |  |
| Main parking problem confirmed by research |  |
| Evidence that this problem is common or costly |  |
| First location or neighborhood to launch in |  |
| Main alternatives people use today |  |

## 1.2 Who Takes Part and What They Exchange

The app suggests two possible sides: people looking for parking and parking-place operators. The project has not connected the sample operators to the app, so the diagram below describes the current demonstration, not an active business relationship.

```text
People looking for parking
  - Give: a typed or spoken request and parking preferences
  - Receive: sample parking listings and simulated availability
                     |
                     v
             SwapSpot demonstration
  - Shows sample listings, map, prices, and features
  - Does not collect a real payment or confirm a booking
                     |
                     v
Parking-place operators named in sample data
  - Live information supplied to SwapSpot:
  - Confirmed business relationship:
```

| Exchange between the sides | Detail |
|---|---|
| What visitors give or contribute | A request and optional parking preferences during the demo |
| What visitors receive today | Sample listings and simulated parking information |
| What operators give to the live service |  |
| What operators receive from the live service |  |
| Money paid by visitors or operators |  |
| Trust or safety checks between the sides |  |

## 1.3 Changes from Midterm to Final

The project files show the current app, but do not include midterm feedback, a change log, or a record of decisions made after a presentation.

| Midterm idea or feedback | Change made for the final version | Reason / evidence |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |

# Chapter 2: Service Experience and Business Model

## 2.1 Service Walkthrough

This table follows a visitor through the current demonstration. A “behind-the-scenes” step means work performed inside the app; it does not mean a real parking operator has received the request.

| Step | Visitor action | What the app shows | What happens behind the screen | Real operator involvement |
|---|---|---|---|---|
| 1. Ask for parking | Speaks, types, or chooses a suggested request | A short answer and a list or map of sample places | The app looks for words such as a place name, price, distance, or feature |  |
| 2. Compare places | Searches, changes filters, or opens a place | Sample price, open-space count, distance, hours, and features | The app checks and sorts its sample list |  |
| 3. View a place | Opens its detail page | Sample address, price, spaces, rating, and features | The app displays information already included in the sample list |  |
| 4. Choose a space | Taps a sample open space | A two-hour demo timer and estimated fee | The app changes local screen state; nothing is reserved in a real lot |  |
| 5. View a route or camera | Opens the route or camera page | A map preview or a static image with moving labels | The app draws a sample route or changes sample camera labels |  |

## 2.2 Four-Part Return Loop

The service can be described with a simple four-part loop. This describes the screens and behavior in the demo; it does not prove that visitors form a habit or return to use it.

| Part of the loop | What is present in the demo |
|---|---|
| Reminder to use it | A visitor may open SwapSpot when looking for parking. A saved reminder or advertising campaign is not shown. |
| Easy first step | Tap the microphone, type a request, or choose a suggested request. |
| Changing result | Different sample places, prices, features, and simulated availability can appear for different requests. |
| Saved benefit for next time | Parking preferences are saved in the browser. Account-based history, loyalty rewards, and saved reservations are not shown. |

Evidence that visitors return, and how often they return |  

## 2.3 Pricing and Business Model

The app displays sample hourly and daily prices for parking places. These are listing details in the demonstration, not a price charged by SwapSpot. The project files do not include a service fee, commission, payment split, deposit, refund policy, or operating-cost estimate.

| Business question | Detail |
|---|---|
| Price charged by SwapSpot to visitors |  |
| Fee or commission charged to operators |  |
| Portion of each payment kept by SwapSpot |  |
| Portion paid to the parking operator |  |
| Deposit, cancellation, refund, or dispute rules |  |
| Which side, if any, receives a discount or subsidy |  |
| Cost to attract one visitor |  |
| Cost to attract one parking operator |  |
| Estimated cost to run the service |  |

# Chapter 3: Working Prototype and Visitor Journeys

## 3.1 Visitor Journey: Finding a Place

1. The visitor opens the main screen and sees one nearby sample place.
2. They tap the microphone, type a request, or choose a suggested request such as “Find parking” or “EV charging.”
3. SwapSpot looks through its sample places and checks the requested price, distance, and features.
4. The visitor sees a list or map and can open a place for more information.
5. The visitor can ask to see a simulated route. It is not safe to use as driving directions.

## 3.2 Visitor Journey: Choosing a Sample Space

1. The visitor opens a sample place and chooses “Choose spot.”
2. The app shows 12 sample spaces as available, occupied, or booked.
3. Tapping an available space marks it as the visitor's demo space.
4. A two-hour timer starts and shows a sample estimated fee.
5. The visitor can end the demo session.

No real reservation is sent to a parking operator, and the sample session disappears when the page is reloaded.

## 3.3 Supplier and Platform Journeys

The project contains no screen for an operator to join, add a parking place, change its availability, manage bookings, or receive payment. The sample places are written into the project by its builders. The work required for real operators and platform staff is:

| Journey | Current screen or process |
|---|---|
| Operator signs up or proves ownership of a lot |  |
| Operator adds or changes parking information |  |
| Operator accepts or rejects a real booking |  |
| Platform handles payment, refunds, or disputes |  |
| Platform checks listing accuracy or customer complaints |  |

## 3.4 What Works Now, What Is Simulated, and What Is Not Built

| Part of the experience | Status in the current project |
|---|---|
| Main parking search screen | Present in the demo |
| Typed parking requests | Present in the demo |
| Speech input and spoken replies | Uses browser voice features where the browser supports them |
| Search by place, price, distance, and parking features | Runs against sample information |
| Map | Uses a map and public map images; the parking information is still sample data |
| Lot availability | Simulated and changes on the screen |
| Parking space selection | Simulated; does not reserve a real space |
| Parking timer and estimated fee | Simulated; not a payment or bill |
| Route preview | Simulated; not driving directions |
| Camera view | Static image with simulated labels; not a live camera |
| Parking operator connection |  |
| Customer account and payment |  |
| Real-time lot availability |  |
| AI service |  |

## 3.5 Build Tools in Plain Language

The project is a website. It uses a map service and the speech features available in some web browsers. The project also includes automatic checks of the search, settings, parking calculations, timers, and spoken requests.

| Project access item | Link |
|---|---|
| Public demo link |  |
| Backup demo video |  |
| Design board / Miro link |  |

# Chapter 4: User Testing and Improvements

The project includes checks that test whether parts of the software behave as expected. These checks are not interviews or tests with real drivers or parking operators. No participant list, interview notes, user quotes, or before-and-after screen records are included in the inspected project.

## 4.1 People Who Tested the Service

| Tester role | How they fit the intended audience | Test setting | Task given |
|---|---|---|---|
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |

Number of people who tested the app |  
Dates and location of tests |  

## 4.2 What Was Confirmed and What Caused Trouble

The project files cannot show that a feature was understood or valued by real people. Add direct evidence from user sessions before marking any assumption as confirmed.

| Assumption or screen | Confirmed / not confirmed | What the tester said or did |
|---|---|---|
| Visitors understand that spaces are real or simulated |  |  |
| Visitors trust the availability information |  |  |
| Visitors understand the listed price |  |  |
| Visitors can find and compare places |  |  |
| Visitors understand that choosing a space is not a real booking |  |  |
| Visitors understand that the route is not for driving |  |  |
| Operators want to join or update their listings |  |  |

## 4.3 Visitor Friction and Drop-Off

| Where the visitor hesitated or stopped | Direct quote / observation | How often it happened |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |

## 4.4 Changes Made After User Feedback

No user-feedback change record is included in the project. The table below is ready for evidence-backed updates.

| Before: screen or wording | After: screen or wording | User feedback that led to the change |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |

# Chapter 5: Future Growth and Trust

This chapter separates ideas visible in the project notes from features that are not yet built. The project notes mention future sign-in and database services, but say they are not set up. Real parking connections and route providers have not been chosen.

## 5.1 Physical Parking and Digital Service

The current project does not connect to parking gates, QR codes, vehicle sensors, or live cameras.

| Future service idea | Detail |
|---|---|
| How a driver would prove they arrived |  |
| QR, RFID, or other gate equipment |  |
| Live parking count source |  |
| Live camera or other equipment |  |
| Cost and party responsible for equipment |  |

## 5.2 Smart Help and Human Review

The current assistant follows written rules to understand a request. It does not connect to an AI service. A real booking, payment, complaint, or safety decision is not handled by the app.

| Future automatic task | Human who must review it |
|---|---|
|  |  |
|  |  |

## 5.3 Fair Rules, Privacy, and Staying on the Platform

The project does not include accounts, payment details, user profiles, or operator messaging. It saves parking preferences in the visitor's browser. The microphone and browser speech features are subject to the visitor's browser permissions; the project notes that some browsers may use a remote speech service.

| Trust or privacy question | Detail |
|---|---|
| What user information will be collected and why |  |
| Which optional information will not be collected |  |
| How a visitor can remove their information |  |
| How parking places will be checked for accuracy |  |
| How fake listings or unfair pricing will be handled |  |
| How the service will handle a complaint or refund |  |
| How the service will discourage parties from bypassing the platform |  |

## 5.4 First-User Growth Plan

The project does not include a launch plan, marketing results, sign-up totals, or a plan for attracting both visitors and parking operators.

| Growth question | Detail |
|---|---|
| First group of visitors to invite |  |
| First parking operators to invite |  |
| Reason each side would join before the other side is large |  |
| First target number of visitors and timeframe |  |
| Community or environmental benefit and how it will be measured |  |

# Chapter 6: Honest Review and Semester Reflection

## 6.1 Expectation Compared with What Exists

The project files do not include the midterm goals or real user-test results. The table below compares only visible project features with the evidence still needed.

| Topic | What the current project shows | What remains to be proven |
|---|---|---|
| Finding parking | Search, map, and filters work with sample information | Whether real visitors can find a suitable real space |
| Availability | On-screen counts change as a simulation | Whether operator data can be accurate and timely |
| Reservations | A sample space can be selected in the demo | Whether a real operator will confirm and honor a booking |
| Route and camera | Sample route and camera screens are present | Whether live, safe, and reliable services can be provided |
| Business model | Sample parking prices are displayed | Whether visitors or operators will pay SwapSpot |
| User experience | A visitor can speak or type a request | Whether real users understand and trust the service |

Midterm expectation or goal |  
What changed after the midterm |  
Evidence of user reaction |  

## 6.2 Viability: Main Advantage and Main Risk

The project files do not contain market research, competitor research, operator agreements, or real transaction data. Therefore, a proven business advantage and a confirmed market risk cannot be named from the code alone.

| Viability question | Detail |
|---|---|
| Strongest proven reason SwapSpot would win |  |
| Biggest risk to the project |  |
| Evidence supporting the reason and risk |  |
| Decision: continue, change direction, or stop |  |

## 6.3 Team Reflection and Contributions

| Team member | Student ID | Main area of work | Contribution evidence |
|---|---|---|---|
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |

What the team learned about moving from a product idea to a service with more than one side |  

What the team would do differently next |  

# Appendices

## Appendix A: Current Sample Parking Information

The demonstration includes 16 sample parking places in central Bangkok. The project gives each sample place a name, map position, capacity, sample open-space count, hourly and daily prices, opening hours, features, and an operator label. These are demonstration details, not verified live offers.

Example from the app:

| Sample place | Sample price | Sample total spaces | Sample open spaces at start | Notes |
|---|---:|---:|---:|---|
| Siam Paragon Garage | ฿60 per hour | 2,600 | 520 | Sample EV and accessible spaces; covered |

## Appendix B: Project Evidence Reviewed

This draft is based on the project overview, the sample parking-place list, and the pages for search, map, parking-place details, sample space selection, route preview, camera view, and voice input. The project also includes automatic software checks. These checks do not replace interviews or tests with drivers and parking operators.

## Appendix C: Research Materials and Links

| Item | Link / location |
|---|---|
| Prototype link |  |
| Backup screen-recording video |  |
| Design board / Miro canvas |  |
| Interview notes / test recordings |  |
| Survey results |  |

## Completion Note

This draft is based on the working demonstration and is not yet a complete 12–20 page platform dossier. The major missing items are real customer and operator research, user-test evidence, a verified business model, service agreements, payment rules, growth plans, team contribution details, and proof that a live parking service can be delivered. These sections remain blank until the team can add reliable evidence.
