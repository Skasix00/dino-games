import type { ObstacleKind, RunnerState } from '@/types/runner';

import { jumpHeight, runnerRow } from '@/utils/runner/engine';

const WIDTH = 400;
const HEIGHT = 640;
const HORIZON = 182;

function polygon(context: CanvasRenderingContext2D, points: number[][], color: string) {
	context.fillStyle = color;
	context.beginPath();
	points.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
	context.closePath();
	context.fill();
}

function ellipse(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	rx: number,
	ry: number,
	color: string,
) {
	context.fillStyle = color;
	context.beginPath();
	context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
	context.fill();
}

function rectangle(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	color: string,
	radius = 0,
) {
	context.fillStyle = color;
	context.beginPath();
	context.roundRect(x, y, width, height, radius);
	context.fill();
}

function project(lane: number, z: number) {
	const depth = Math.max(0, 1 - z / 120);
	const scale = 0.08 + depth * depth * 0.92;

	return { x: WIDTH / 2 + (lane - 1) * 119 * scale, y: HORIZON + depth * depth * 390, scale };
}

function building(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	color: string,
) {
	rectangle(context, x, y, width, height, color, 5);
	rectangle(context, x - 3, y - 4, width + 6, 8, '#e7c59c', 3);

	for (let row = 0; row < 3; row++) {
		for (let column = 0; column < 2; column++) {
			rectangle(context, x + 10 + column * (width - 30), y + 15 + row * 30, 13, 18, '#3b6870', 5);
			rectangle(context, x + 8 + column * (width - 30), y + 31 + row * 30, 17, 3, '#f8e9c9', 1);
		}
	}

	rectangle(context, x + 3, y + height - 28, width - 6, 10, '#f7e7c2');

	for (let stripe = 0; stripe < width - 6; stripe += 14) {
		rectangle(context, x + 3 + stripe, y + height - 28, 7, 12, '#bd4d3e', 2);
	}
}

function scenery(context: CanvasRenderingContext2D, distance: number) {
	const sky = context.createLinearGradient(0, 0, 0, 290);
	sky.addColorStop(0, '#9ddadf');
	sky.addColorStop(1, '#eff3d4');
	context.fillStyle = sky;
	context.fillRect(0, 0, WIDTH, HEIGHT);
	ellipse(context, 316, 67, 30, 30, '#fff2bb');

	for (const [x, y] of [
		[48, 53],
		[208, 92],
		[352, 118],
	]) {
		ellipse(context, x, y, 28, 9, '#ffffffa8');
		ellipse(context, x - 6, y - 7, 14, 11, '#ffffffa8');
	}

	polygon(
		context,
		[
			[0, 190],
			[65, 105],
			[132, 184],
			[208, 113],
			[290, 188],
			[345, 130],
			[400, 183],
		],
		'#9bbd8c',
	);
	building(context, -8, 88, 69, 172, '#e8b77c');
	building(context, 62, 133, 49, 111, '#e7c890');
	building(context, 342, 80, 68, 188, '#e3a68c');
	building(context, 289, 125, 50, 122, '#f1d398');
	polygon(
		context,
		[
			[0, 210],
			[159, HORIZON],
			[241, HORIZON],
			[400, 210],
			[400, 640],
			[0, 640],
		],
		'#8cb67b',
	);
	polygon(
		context,
		[
			[156, HORIZON],
			[244, HORIZON],
			[434, HEIGHT],
			[-34, HEIGHT],
		],
		'#f3dfac',
	);
	polygon(
		context,
		[
			[162, HORIZON],
			[238, HORIZON],
			[405, HEIGHT],
			[-5, HEIGHT],
		],
		'#cfae7b',
	);
	polygon(
		context,
		[
			[190, HORIZON],
			[210, HORIZON],
			[269, HEIGHT],
			[132, HEIGHT],
		],
		'#d9bb89',
	);

	// Moving paving joints provide speed cues without flashing or camera shake.
	for (let index = 0; index < 14; index++) {
		const z = index * 10 - (distance % 10);
		const position = project(1, z);
		const width = 180 * position.scale;
		context.strokeStyle = '#b9966555';
		context.lineWidth = 1 + position.scale;
		context.beginPath();
		context.moveTo(200 - width, position.y);
		context.lineTo(200 + width, position.y);
		context.stroke();
	}

	context.strokeStyle = '#f7e7bd';
	context.lineWidth = 3;
	for (const end of [132, 269]) {
		context.beginPath();
		context.moveTo(200 + (end - 200) * 0.12, HORIZON);
		context.lineTo(end, HEIGHT);
		context.stroke();
	}

	for (let index = 0; index < 5; index++) {
		const position = project(1, index * 30 + 10 - (distance % 30));
		for (const side of [-1, 1]) {
			const x = 200 + side * (214 * position.scale + 12);
			rectangle(
				context,
				x - 3 * position.scale,
				position.y - 40 * position.scale,
				6 * position.scale,
				40 * position.scale,
				'#896741',
			);
			ellipse(
				context,
				x,
				position.y - 57 * position.scale,
				23 * position.scale,
				31 * position.scale,
				'#4d8b53',
			);
			ellipse(
				context,
				x - 7 * position.scale,
				position.y - 63 * position.scale,
				13 * position.scale,
				20 * position.scale,
				'#6da45e',
			);
		}
	}
}

function obstacle(
	context: CanvasRenderingContext2D,
	kind: ObstacleKind,
	x: number,
	y: number,
	scale: number,
) {
	context.save();
	context.translate(x, y);
	context.scale(scale, scale);
	ellipse(context, 0, 2, 39, 9, '#4e493b30');

	if (kind === 'crate') {
		rectangle(context, -35, -45, 70, 45, '#a7673d', 5);
		rectangle(context, -31, -41, 62, 34, '#ce9453', 2);
		context.strokeStyle = '#f0c58a';
		context.lineWidth = 5;
		context.beginPath();
		context.moveTo(-28, -37);
		context.lineTo(27, -10);
		context.moveTo(27, -37);
		context.lineTo(-28, -10);
		context.stroke();
	} else if (kind === 'arch') {
		rectangle(context, -43, -100, 8, 100, '#876f53', 3);
		rectangle(context, 35, -100, 8, 100, '#876f53', 3);
		rectangle(context, -45, -107, 90, 55, '#c65844', 4);
		for (let stripe = -40; stripe < 42; stripe += 20) {
			polygon(
				context,
				[
					[stripe, -107],
					[stripe + 10, -107],
					[stripe + 27, -52],
					[stripe + 17, -52],
				],
				'#fff2ca',
			);
		}
	} else {
		rectangle(context, -39, -102, 78, 97, '#4e7b72', 9);
		rectangle(context, -32, -92, 64, 37, '#c6e2d5', 6);
		rectangle(context, -30, -45, 60, 27, '#f4dfb0', 3);
		context.fillStyle = '#a84634';
		context.font = 'bold 13px Arial';
		context.textAlign = 'center';
		context.fillText('PIZZA', 0, -26);
		rectangle(context, -36, -5, 14, 10, '#344941', 4);
		rectangle(context, 22, -5, 14, 10, '#344941', 4);
	}

	context.restore();
}

function dinosaur(context: CanvasRenderingContext2D, x: number, y: number, state: RunnerState) {
	const sliding = state.slideUntil > state.tick;
	const jumping = jumpHeight(state);
	const stride = Math.sin(state.tick * 0.34) * (jumping > 0 ? 2 : 6);
	ellipse(context, x, y + 3, sliding ? 36 : 29, 8, '#344b3638');
	context.save();
	context.translate(x, y - jumping * 75);

	if (sliding) {
		context.translate(0, 7);
		context.scale(1.2, 0.48);
	}

	// Tail, dorsal plates, stomping feet and a party hat keep the runner unmistakably a dinosaur.
	context.fillStyle = '#4f8d4e';
	context.beginPath();
	context.moveTo(16, -39);
	context.quadraticCurveTo(55, -9, 48, -49);
	context.quadraticCurveTo(72, -4, 17, -8);
	context.fill();
	for (let index = 0; index < 4; index++) {
		polygon(
			context,
			[
				[23, -72 + index * 14],
				[38, -67 + index * 14],
				[25, -58 + index * 14],
			],
			'#356e3f',
		);
	}
	ellipse(context, -13, -3 + stride, 13, 8, '#4b8449');
	ellipse(context, 14, -3 - stride, 13, 8, '#4b8449');
	ellipse(context, 0, -35, 27, 32, '#77ad52');
	ellipse(context, -3, -30, 16, 22, '#e9ce7c');
	ellipse(context, -25, -38 + stride, 8, 15, '#6a9d4d');
	ellipse(context, 25, -38 - stride, 8, 15, '#6a9d4d');
	ellipse(context, 0, -78, 34, 29, '#8dbb5b');
	ellipse(context, -17, -67, 21, 15, '#8dbb5b');
	ellipse(context, -14, -81, 10, 13, '#fffbe5');
	ellipse(context, 10, -83, 10, 13, '#fffbe5');
	ellipse(context, -12, -81, 5, 8, '#273b2d');
	ellipse(context, 12, -83, 5, 8, '#273b2d');
	ellipse(context, -10, -84, 2, 3, '#ffffff');
	ellipse(context, 14, -86, 2, 3, '#ffffff');
	ellipse(context, -23, -63, 7, 4, '#dc9474');
	context.strokeStyle = '#385638';
	context.lineWidth = 2;
	context.beginPath();
	context.arc(-3, -64, 9, 0.1, Math.PI - 0.3);
	context.stroke();
	polygon(
		context,
		[
			[-19, -102],
			[4, -139],
			[23, -102],
		],
		'#f8efcf',
	);
	polygon(
		context,
		[
			[-19, -102],
			[4, -139],
			[-3, -102],
		],
		'#427c51',
	);
	polygon(
		context,
		[
			[4, -139],
			[23, -102],
			[12, -102],
		],
		'#c2513f',
	);
	ellipse(context, 4, -139, 6, 6, '#d16a49');
	context.restore();
}

export function drawRunner(
	canvas: HTMLCanvasElement,
	state: RunnerState,
	seed: number,
	visualLane: number,
) {
	const context = canvas.getContext('2d');

	if (!context) {
		return;
	}

	const ratio = Math.min(window.devicePixelRatio || 1, 2);
	const width = Math.round(canvas.clientWidth * ratio);
	const height = Math.round(canvas.clientHeight * ratio);

	if (canvas.width !== width || canvas.height !== height) {
		canvas.width = width;
		canvas.height = height;
	}

	context.setTransform(width / WIDTH, 0, 0, height / HEIGHT, 0, 0);
	scenery(context, state.distance);
	const firstRow = Math.max(0, state.nextRow - 1);

	for (let index = firstRow + 5; index >= firstRow; index--) {
		const row = runnerRow(seed, index);
		const z = row.distance - state.distance;

		if (z < -5 || z > 120) {
			continue;
		}

		for (const item of row.obstacles) {
			const position = project(item.lane, z);
			obstacle(context, item.kind, position.x, position.y, position.scale);
		}

		if (index >= state.nextRow) {
			for (let coin = 0; coin < 5; coin++) {
				const position = project(row.coinLane, z + coin * 2);
				ellipse(
					context,
					position.x,
					position.y - 17 * position.scale,
					9 * position.scale,
					11 * position.scale,
					'#b9892a',
				);
				ellipse(
					context,
					position.x,
					position.y - 19 * position.scale,
					7 * position.scale,
					9 * position.scale,
					'#ffdc65',
				);
			}
		}
	}

	dinosaur(context, project(visualLane, 0).x, 568, state);
}
