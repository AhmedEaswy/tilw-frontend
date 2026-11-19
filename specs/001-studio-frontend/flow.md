# App Flow

Dashed nodes with ⚠ are **gaps** (no Figma screen yet — see [gaps.md](./gaps.md)).
Numbers in brackets are Figma node ids on page `02 · Prototype`.

## 1. Access & auth

```mermaid
flowchart TD
  L["Landing /"] -->|دخول| SI["Sign in [6:62]"]
  L -->|اطلب دعوة / جرّب| WL["Waitlist [6:63]"]
  L -->|جرّب الملقّن| DEMO["Reader demo [6:6–6:17]"]
  WL --> WLC["On the list [6:64]"]
  WLC -.email invite.-> INV["⚠ Accept invite: name + password (G1)"]:::gap
  INV --> LIB
  SI -->|success| LIB["Script library"]
  SI -->|نسيت كلمة المرور| FP["Request reset [6:101]"]
  FP --> FPS["Check your email [6:102]"]
  FPS -.email link.-> RP["⚠ Set new password (G2)"]:::gap
  RP -->|valid| LIB
  RP -->|expired| RPX["⚠ Link expired (G2)"]:::gap --> FP
  SI --> LEGAL["Privacy [6:81] · Terms [6:82]"]
  classDef gap stroke-dasharray:5 4,stroke:#c0392b,color:#c0392b
```

## 2. Core loop: write → rehearse → record → keep

```mermaid
flowchart LR
  subgraph Library["/app/scripts"]
    E0["Empty library [6:22]"] --> NEW["New script [6:23]"]
    E0 --> IMP["Import TXT [6:24]"]
    LIB["Library [6:18] · pinned [6:112] · archived [6:111]"] --> SORT["Sort [6:25]"]
    LIB --> ACT["Actions [6:108]: rename [6:109] · TXT [6:110] · pin · archive · duplicate"]
    ACT -.-> DEL["⚠ Restore / delete forever (G9)"]:::gap
  end
  NEW --> ED
  IMP --> ED
  LIB --> ED["Editor [6:19]"]
  ED --> MARKS["⚠ Delivery marks panel (G7)"]:::gap
  ED --> PLUS["⚠ Tilw Plus line breaks (G6)"]:::gap
  ED -->|version mismatch| CF["Compare copies [6:72]"] --> CFR["Confirm replace [6:73]"] --> ED
  ED -->|تدريب| RH["Rehearsal [6:26/6:27]"]
  RH --> RS["Reading settings [6:28/6:29]"] --> RM["More controls [6:30]"]
  RH -->|position not saved| RR["Recovery [6:79]"] --> RP["Choose paragraph [6:80]"] --> RH
  RH -.-> REM["⚠ Phone remote pairing + control (G3)"]:::gap
  RH -->|إعداد التسجيل| ST
  subgraph Studio["/app/scripts/:id/record"]
    ST{"Mode"} -->|فيديو وصوت| CB["Camera before permission [6:38]"]
    ST -->|صوت| AB["Audio before permission [6:50]"]
    CB --> CP["Preview + devices [6:39]"]
    AB --> AS["Sound check [6:51]"]
    CB & AB -->|denied| DN["Access denied [6:78]"]
    DN -->|تدرب دون تسجيل| RH
    CP & AS --> CD["Countdown [6:42/6:54]"] --> REC["Recording [6:44/6:56]"]
    REC -.10:00 / quota / interrupted.-> RECX["⚠ Auto-stop & partial-save states (G8)"]:::gap
  end
  REC -->|إيقاف وحفظ| TR["Take review [6:46/6:58]"]
  TR --> DL["Download requested [6:48/6:60]"]
  TR -.-> TA["⚠ Star / delete take (G8)"]:::gap
  classDef gap stroke-dasharray:5 4,stroke:#c0392b,color:#c0392b
```

## 3. Recordings & settings

```mermaid
flowchart TD
  NAV(("App nav")) --> RL["Recordings [6:74] / first visit [6:77]"]
  RL --> RV["Review audio [6:75] / video [6:46]"] --> RD["Download request [6:76]"]
  NAV --> SET["Preferences [6:65]"]
  SET --> EX1["Export: confirm password [6:66]"] --> EX2["Browser handoff [6:67]"]
  SET --> LG1["Legacy: consent [6:68]"] --> LG2["Choose script [6:69]"] --> LG3["Confirm add [6:70/6:71]"] --> LIB2["Library"]
  SET --> RS2["Reading settings"]
  SET --> OUT["Sign out"] --> SIGNIN["Sign in"]
  SET -.-> ACC["⚠ Edit name / change password (G5)"]:::gap
  SET -.-> DELA["⚠ Delete account (G4)"]:::gap
  classDef gap stroke-dasharray:5 4,stroke:#c0392b,color:#c0392b
```
