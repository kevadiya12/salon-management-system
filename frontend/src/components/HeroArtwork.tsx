interface HeroArtworkProps {
  label: string;
}

function HeroArtwork({ label }: HeroArtworkProps) {
  return (
    <svg
      aria-label={label}
      className="relative z-10 mx-auto block h-auto w-full max-w-[500px] animate-float"
      fill="none"
      role="img"
      viewBox="0 0 540 590"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="mirror" x1="144" x2="412" y1="87" y2="438">
          <stop stopColor="#5E5140" />
          <stop offset="1" stopColor="#292824" />
        </linearGradient>
        <linearGradient id="silhouette" x1="218" x2="353" y1="194" y2="426">
          <stop stopColor="#D8C6A0" />
          <stop offset="1" stopColor="#A89068" />
        </linearGradient>
        <clipPath id="mirror-clip">
          <path d="M146 425V234C146 157 199 102 270 102C341 102 394 157 394 234V425H146Z" />
        </clipPath>
      </defs>

      <path
        d="M270 25C121 25 36 119 36 271V531C36 550 51 565 70 565H470C489 565 504 550 504 531V271C504 119 419 25 270 25Z"
        fill="#211F1B"
      />
      <path
        d="M270 51C140 51 61 133 61 271V516H479V271C479 133 400 51 270 51Z"
        stroke="#C6A66A"
        strokeOpacity=".42"
        strokeWidth="1.5"
      />
      <path
        d="M124 470V229C124 140 186 78 270 78C354 78 416 140 416 229V470H124Z"
        fill="#C6A66A"
        fillOpacity=".76"
      />
      <path
        d="M146 425V234C146 157 199 102 270 102C341 102 394 157 394 234V425H146Z"
        fill="url(#mirror)"
      />
      <g clipPath="url(#mirror-clip)">
        <path
          d="M144 351C181 311 210 297 270 297C330 297 363 316 397 355V445H144V351Z"
          fill="#37352F"
        />
        <path
          d="M188 444C194 378 218 348 269 348C321 348 346 378 352 444H188Z"
          fill="url(#silhouette)"
        />
        <path
          d="M232 290H308V370C300 385 287 394 270 394C253 394 240 385 232 370V290Z"
          fill="#B69E75"
        />
        <path
          d="M205 236C205 183 230 151 270 151C311 151 335 184 335 236C335 291 309 326 270 326C231 326 205 291 205 236Z"
          fill="#D9C9A6"
        />
        <path
          d="M199 246C189 188 214 136 269 136C316 136 345 170 342 225C329 215 322 203 319 187C295 205 259 212 215 209C214 225 210 239 199 246Z"
          fill="#171715"
        />
        <path
          d="M240 251C248 256 255 256 262 251M279 251C287 256 294 256 301 251"
          stroke="#544734"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <path
          d="M258 283C266 288 274 288 282 283"
          stroke="#967C55"
          strokeLinecap="round"
          strokeWidth="2"
        />
        <path
          d="M230 314C241 326 254 332 270 332C286 332 299 326 310 314"
          stroke="#C6A66A"
          strokeLinecap="round"
          strokeOpacity=".7"
          strokeWidth="2"
        />
        <path
          d="M156 155C174 127 202 108 231 102"
          stroke="#F2EEE5"
          strokeLinecap="round"
          strokeOpacity=".2"
          strokeWidth="2"
        />
      </g>
      <path
        d="M105 452H435M178 480H362"
        stroke="#C6A66A"
        strokeOpacity=".48"
        strokeWidth="1.5"
      />
      <path
        d="M200 496V525M340 496V525M182 527H358"
        stroke="#8F7953"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <circle cx="92" cy="447" r="4" fill="#D8C6A0" />
      <circle cx="448" cy="447" r="4" fill="#D8C6A0" />
      <path
        d="M88 488C99 464 109 451 122 446M89 488C109 477 122 475 137 479M88 488C97 490 108 497 114 510"
        stroke="#A7A080"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M452 488C441 464 431 451 418 446M451 488C431 477 418 475 403 479M452 488C443 490 432 497 426 510"
        stroke="#A7A080"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

export default HeroArtwork;
