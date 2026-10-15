interface MascotProps {
	className?: string;
}

export default function Mascot({ className }: MascotProps) {
	return (
		<svg
			aria-label="BennyRex, o dinossauro da festa, com uma fatia de pizza"
			className={className}
			role="img"
			viewBox="0 0 400 380"
		>
			<defs>
				<linearGradient id="dino-green" x2="0.8" y2="1">
					<stop stopColor="#a8cb6a" />
					<stop offset="1" stopColor="#62934b" />
				</linearGradient>
			</defs>
			<ellipse cx="207" cy="347" fill="#d9d9ba" opacity=".5" rx="132" ry="14" />
			<path
				d="M276 261 Q351 310 360 240 Q385 328 278 330"
				fill="#6c994a"
				stroke="#375c37"
				strokeWidth="4"
			/>
			<path
				d="M262 141 L282 125 L290 153 L306 151 L304 180 L319 184 L308 210 L320 222 L299 244"
				fill="#426d3d"
				stroke="#375c37"
				strokeLinejoin="round"
				strokeWidth="3"
			/>
			<ellipse
				cx="213"
				cy="258"
				fill="url(#dino-green)"
				rx="83"
				ry="84"
				stroke="#375c37"
				strokeWidth="4"
			/>
			<ellipse cx="211" cy="278" fill="#edcf7b" rx="48" ry="61" />
			<path
				d="M175 273 Q210 287 248 272 M179 294 Q210 306 244 294 M189 315 Q210 322 234 314"
				fill="none"
				stroke="#d0af61"
				strokeWidth="3"
			/>
			<path
				d="M151 308 Q115 305 117 337 Q138 354 179 341 L180 320 M247 317 Q277 304 292 334 Q289 352 246 343"
				fill="#78a651"
				stroke="#375c37"
				strokeWidth="4"
			/>
			<path
				d="M128 338 L132 329 L140 340 M149 342 L155 331 L163 342 M258 342 L263 331 L272 342"
				fill="#efd78f"
			/>
			<path
				d="M159 225 Q133 235 115 207 Q99 187 91 209 Q99 249 140 257 M271 224 Q294 232 295 267 Q287 284 273 271"
				fill="#8bb65a"
				stroke="#375c37"
				strokeLinecap="round"
				strokeWidth="4"
			/>
			<path
				d="M145 129 Q143 84 180 107 Q219 77 264 117 Q294 138 291 181 Q293 223 249 234 L159 229 Q99 227 104 181 Q107 152 145 149Z"
				fill="url(#dino-green)"
				stroke="#375c37"
				strokeWidth="4"
			/>
			<ellipse cx="164" cy="168" fill="#fffdf3" rx="20" ry="26" />
			<ellipse cx="246" cy="164" fill="#fffdf3" rx="21" ry="27" />
			<ellipse cx="169" cy="172" fill="#283b29" rx="10" ry="16" />
			<ellipse cx="242" cy="169" fill="#283b29" rx="10" ry="16" />
			<circle cx="172" cy="166" fill="white" r="4" />
			<circle cx="245" cy="163" fill="white" r="4" />
			<ellipse cx="137" cy="198" fill="#dd9278" opacity=".65" rx="14" ry="9" />
			<ellipse cx="269" cy="194" fill="#dd9278" opacity=".65" rx="13" ry="9" />
			<path
				d="M174 208 Q203 239 231 206"
				fill="#753d32"
				stroke="#375c37"
				strokeLinecap="round"
				strokeWidth="3"
			/>
			<path d="M191 223 Q204 211 218 222" fill="#e29284" />
			<path
				d="M204 197 Q187 184 174 199 Q165 205 154 196 Q159 218 184 210 L204 203 Q227 221 246 200 Q231 208 221 196 Q211 190 204 197"
				fill="#4c3b29"
			/>
			<circle cx="193" cy="185" fill="#436b38" r="3" />
			<circle cx="213" cy="184" fill="#436b38" r="3" />
			<path
				d="M168 105 L238 29 L276 113 Q228 133 168 105"
				fill="#fcf7e7"
				stroke="#375c37"
				strokeLinejoin="round"
				strokeWidth="4"
			/>
			<path d="M168 105 L238 29 L218 118Z" fill="#427849" />
			<path d="M238 29 L276 113 L248 121Z" fill="#bc4435" />
			<circle cx="239" cy="28" fill="#c54b39" r="12" />
			<path
				d="M73 165 L127 179 L97 223Z"
				fill="#f1cf79"
				stroke="#985b32"
				strokeLinejoin="round"
				strokeWidth="3"
			/>
			<path
				d="M73 165 Q101 161 127 179"
				fill="none"
				stroke="#c68c4e"
				strokeLinecap="round"
				strokeWidth="10"
			/>
			<circle cx="97" cy="183" fill="#bc4435" r="6" />
			<circle cx="103" cy="201" fill="#bc4435" r="5" />
			<path
				d="M86 188 L91 194 M113 182 L112 187"
				stroke="#567d40"
				strokeLinecap="round"
				strokeWidth="3"
			/>
			<path
				d="M72 87 L78 74 M315 72 L326 77 M333 147 L342 137 M96 282 L82 287"
				stroke="#b9a56a"
				strokeLinecap="round"
				strokeWidth="4"
			/>
			<path
				d="M103 113 L109 119 M310 294 L317 300"
				stroke="#c95644"
				strokeLinecap="round"
				strokeWidth="5"
			/>
			<circle cx="124" cy="64" fill="#c95644" r="4" />
			<circle cx="320" cy="239" fill="#bc9d58" r="4" />
		</svg>
	);
}
