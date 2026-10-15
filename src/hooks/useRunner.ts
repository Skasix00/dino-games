'use client';

import type { RunnerDisplay } from '@/types/runner';

import { useEffect, useRef, useState } from 'react';

import { RunnerController } from '@/utils/runner/controller';
import { initialRunnerState } from '@/utils/runner/engine';

export function useRunner() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const controllerRef = useRef<RunnerController | null>(null);
	const [display, setDisplay] = useState<RunnerDisplay>({
		mode: 'loading',
		state: initialRunnerState(),
		error: '',
		busy: false,
	});

	useEffect(() => {
		if (!canvasRef.current) {
			return;
		}

		const controller = new RunnerController(canvasRef.current, setDisplay);
		controllerRef.current = controller;

		return () => {
			controller.destroy();
			controllerRef.current = null;
		};
	}, []);

	return { canvasRef, controllerRef, display };
}
