"use client";

import type { Settings } from "@/lib/settings";

type Props = {
  settings: Settings;
  voices: SpeechSynthesisVoice[];
  onChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onBack: () => void;
};

export function SettingsView({ settings, voices, onChange, onBack }: Props) {
  function toggle(key: "voiceOut" | "wakeWord" | "lightTheme" | "needEv" | "needDisabled" | "needCovered", label: string, help?: string) {
    return (
      <div className="set-row">
        <div className="lbl">{label}{help && <small>{help}</small>}</div>
        <button
          type="button"
          className={`toggle ${settings[key] ? "on" : ""}`}
          aria-label={label}
          aria-pressed={settings[key]}
          onClick={() => onChange(key, !settings[key])}
        />
      </div>
    );
  }

  return (
    <section className="view active" id="view-settings">
      <div className="settings">
        <div className="back-row"><button className="back-btn" onClick={onBack}>← Back</button></div>
        <div className="set-group">
          <div className="gh">Voice &amp; Audio</div>
          {toggle("voiceOut", "Speak answers aloud", "SwapSpot replies through your speaker")}
          {toggle("wakeWord", "Wake word “Hey SwapSpot”", "Continuous listening after you start the mic (uses more battery)")}
          <label className="set-row"><span className="lbl">Assistant voice</span>
            <select className="set-sel" value={settings.voiceName} onChange={(event) => onChange("voiceName", event.target.value)}>
              <option value="">Default</option>
              {voices.map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} ({voice.lang})</option>)}
            </select>
          </label>
          <label className="set-row"><span className="lbl">Speech rate</span>
            <span><input type="range" className="set-range" min="0.6" max="1.6" step="0.1" value={settings.rate} onChange={(event) => onChange("rate", Number(event.target.value))} /> <span className="range-val">{settings.rate.toFixed(1)}×</span></span>
          </label>
          {toggle("lightTheme", "Light theme", "Off = dark driving mode")}
        </div>
        <div className="set-group">
          <div className="gh">Parking Preferences</div>
          <label className="set-row"><span className="lbl">Max price per hour</span>
            <span><input type="range" className="set-range" min="0" max="200" step="10" value={settings.maxPrice} onChange={(event) => onChange("maxPrice", Number(event.target.value))} /> <span className="range-val">฿{settings.maxPrice}</span></span>
          </label>
          <label className="set-row"><span className="lbl">Search radius</span>
            <span><input type="range" className="set-range" min="1" max="10" step="1" value={settings.radius} onChange={(event) => onChange("radius", Number(event.target.value))} /> <span className="range-val">{settings.radius} km</span></span>
          </label>
          {toggle("needEv", "Require EV charger")}
          {toggle("needDisabled", "Require accessible spot")}
          {toggle("needCovered", "Covered parking only")}
        </div>
        <div className="hint-box"><b>Voice commands:</b> Find parking, ask for the cheapest lot, find EV charging, ask about a named lot, or open your account, checkout and insights.</div>
        <div className="voice-cmds">
          {["Find parking near me", "Cheapest spot within 2 km", "Is CentralWorld full?", "Any free parking?", "EV charging with spot", "Take me to Siam Paragon", "How much per hour?", "Hold a spot for me", "Cancel navigation", "Open my account", "Pay now", "Show insights"].map((command) => (
            <div className="voice-cmd" key={command}><b>“{command}”</b></div>
          ))}
        </div>
        <div className="hint-box">Demo only: sensor readings, payments, navigation, location and camera detection are simulated. Bookings are saved in the project database, but no real space is reserved and no money is taken.</div>
      </div>
    </section>
  );
}
