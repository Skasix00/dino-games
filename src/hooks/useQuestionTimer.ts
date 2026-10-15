'use client';

import { useEffect, useState } from 'react';

export function useQuestionTimer(
	startedAt: number | undefined,
	serverNow: number | undefined,
	running: boolean,
) {
	const [extra, setExtra] = useState(0);

	useEffect(() => {
		if (!running) {
			return;
		}

		const receivedAt = performance.now();
		const timer = window.setInterval(() => setExtra(performance.now() - receivedAt), 100);

		return () => window.clearInterval(timer);
	}, [startedAt, serverNow, running]);

	return Math.max(0, (serverNow ?? 0) - (startedAt ?? 0) + extra);
}
