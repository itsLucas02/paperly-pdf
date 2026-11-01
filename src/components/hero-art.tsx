export function HeroArt() {
  return <svg className="hero-art" viewBox="0 0 440 280" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="paper-edge" x1="160" y1="50" x2="330" y2="240" gradientUnits="userSpaceOnUse"><stop stopColor="#FFFDF9"/><stop offset="1" stopColor="#F4EADF"/></linearGradient>
      <linearGradient id="orange-page" x1="150" y1="50" x2="340" y2="235" gradientUnits="userSpaceOnUse"><stop stopColor="#F9B291"/><stop offset="1" stopColor="#EB7B57"/></linearGradient>
      <filter id="paper-shadow" x="-70%" y="-40%" width="240%" height="220%"><feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#6F4B36" floodOpacity=".12"/></filter>
      <filter id="small-shadow" x="-50%" y="-50%" width="200%" height="220%"><feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#603F2D" floodOpacity=".09"/></filter>
    </defs>
    <ellipse cx="247" cy="246" rx="140" ry="13" fill="#C39E7B" opacity=".07"/>
    <path d="M86 153C54 113 67 64 123 45M350 194c36-17 42-52 28-75" stroke="#D6B69A" strokeWidth="1.3" strokeDasharray="4 5"/>
    <g transform="rotate(12 248 141)" filter="url(#paper-shadow)">
      <rect x="176" y="41" width="151" height="198" rx="9" fill="url(#orange-page)"/>
      <rect x="191" y="58" width="120" height="162" rx="3" stroke="#FFF1E7" strokeOpacity=".7"/>
      <path d="M204 83h60M204 94h88M204 105h74" stroke="#FFF4EB" strokeWidth="5" strokeLinecap="round"/>
      <rect x="205" y="159" width="26" height="36" rx="2" fill="#FFF5EB" fillOpacity=".55"/>
      <rect x="242" y="146" width="26" height="49" rx="2" fill="#FFF5EB" fillOpacity=".75"/>
      <rect x="279" y="131" width="25" height="64" rx="2" fill="#FFF5EB"/>
    </g>
    <g transform="rotate(-5 217 146)" filter="url(#paper-shadow)">
      <path d="M146 36h112l34 34v164a9 9 0 0 1-9 9H146a9 9 0 0 1-9-9V45a9 9 0 0 1 9-9Z" fill="url(#paper-edge)" stroke="#E9E0D4"/>
      <path d="M258 37v25a8 8 0 0 0 8 8h25" fill="#F0E8DC" stroke="#E7DDCE"/>
      <rect x="157" y="57" width="30" height="36" rx="5" fill="#FCE9DE"/>
      <path d="M166 72h11l6 6v10h-17V72Z" fill="#E46C49"/>
      <path d="M176 72v7h7" stroke="#FCE9DE" strokeWidth="1.5"/>
      <text x="165" y="83" fontFamily="Arial,sans-serif" fontSize="5.5" fontWeight="700" fill="white">PDF</text>
      <rect x="158" y="109" width="91" height="7" rx="3.5" fill="#46514A"/>
      <rect x="158" y="124" width="114" height="4" rx="2" fill="#DEDDD5"/>
      <rect x="158" y="134" width="104" height="4" rx="2" fill="#DEDDD5"/>
      <rect x="158" y="144" width="110" height="4" rx="2" fill="#DEDDD5"/>
      <rect x="158" y="168" width="42" height="30" rx="3" fill="#F8EDE2"/>
      <rect x="210" y="168" width="62" height="30" rx="3" fill="#F0F1E9"/>
      <path d="m164 185 7-8 5 4 9-10" stroke="#D98A66" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M217 185h48M217 177h34" stroke="#BFCABD" strokeWidth="3" strokeLinecap="round"/>
      <rect x="158" y="213" width="69" height="3" rx="1.5" fill="#DDDCD5"/>
      <path d="M158 224h114" stroke="#E9E5DC"/>
    </g>
    <g filter="url(#small-shadow)">
      <rect x="58" y="78" width="119" height="39" rx="9" fill="white" stroke="#EEE8DF"/>
      <circle cx="78" cy="97.5" r="10.5" fill="#EAF2E8"/>
      <path d="m74 97 3 3 5-6" stroke="#62805C" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="94" y="101" fontFamily="Arial,sans-serif" fontSize="10.5" fontWeight="600" fill="#4F574B">All together now.</text>
    </g>
    <g filter="url(#small-shadow)">
      <rect x="282" y="181" width="63" height="63" rx="17" fill="#E77550"/>
      <rect x="293" y="193" width="36" height="36" rx="9" stroke="#F9C6AF" strokeWidth="1.2"/>
      <path d="M309 202v18m-9-9h18m-21-9 5-5m14 14 5 5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="m306 204 3-3 3 3M306 220l3 3 3-3" stroke="white" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
    <g transform="translate(364 48)" stroke="#D5815C" strokeWidth="2" strokeLinecap="round"><path d="M0-10v20M-10 0h20M-7-7 7 7M-7 7 7-7"/></g>
    <path d="m108 202 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" fill="#D4A588"/>
    <circle cx="347" cy="132" r="3" fill="#D8B89B"/>
    <circle cx="140" cy="35" r="2.5" fill="#AAB5A0"/>
    <path d="m77 162 4 4-4 4-4-4 4-4Z" fill="#A6B49A"/>
  </svg>;
}
