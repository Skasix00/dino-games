'use client';

import type { FormEvent } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api, errorMessage } from '@/utils/api';

interface AccountFormProps {
	destination: string;
	player: { displayName: string } | null;
}

export default function AccountForm({ destination, player }: AccountFormProps) {
	const router = useRouter();
	const [mode, setMode] = useState<'register' | 'login'>('register');
	const [name, setName] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError('');

		try {
			await api(`auth/${mode}`, { displayName: name, password });
			router.push(destination);
			router.refresh();
		} catch (error) {
			setError(errorMessage(error));
			setBusy(false);
		}
	}

	async function logout() {
		setBusy(true);

		try {
			await api('logout', {});
			router.refresh();
		} catch (error) {
			setError(errorMessage(error));
		} finally {
			setBusy(false);
		}
	}

	if (player) {
		return (
			<section className="panel narrow stack">
				<p className="eyebrow">O TEU CANTINHO</p>
				<h1 className="page-heading">Olá, {player.displayName}!</h1>
				<p className="muted">
					O teu utilizador está pronto. Vamos juntar mais uma memória à festa?
				</p>
				<Link className="button" href={destination}>
					Vamos jogar →
				</Link>
				<Link className="button secondary" href="/leaderboard">
					Ver ranking
				</Link>
				{error && (
					<p className="notice error" role="alert">
						{error}
					</p>
				)}
				<button className="text-link self-start" disabled={busy} onClick={logout} type="button">
					Terminar sessão
				</button>
			</section>
		);
	}

	return (
		<section className="panel narrow stack">
			<div>
				<p className="eyebrow">TENS LUGAR NA FESTA</p>
				<h1 className="page-heading">
					{mode === 'register' ? 'Cria o teu utilizador.' : 'Olá outra vez!'}
				</h1>
				<p className="muted">
					Só precisas de um nome e uma palavra-passe. Os teus resultados ficam contigo, em qualquer
					dispositivo.
				</p>
			</div>
			<div aria-label="Acesso ao utilizador" className="flex gap-3">
				<button
					aria-pressed={mode === 'register'}
					className={`button ${mode === 'login' ? 'secondary' : ''}`}
					type="button"
					onClick={() => {
						setMode('register');
						setError('');
					}}
				>
					Criar utilizador
				</button>
				<button
					aria-pressed={mode === 'login'}
					className={`button ${mode === 'register' ? 'secondary' : ''}`}
					type="button"
					onClick={() => {
						setMode('login');
						setError('');
					}}
				>
					Já tenho utilizador
				</button>
			</div>
			<form className="stack" onSubmit={submit}>
				<div>
					<label htmlFor="username">Nome de utilizador</label>
					<input
						autoComplete="username"
						id="username"
						maxLength={32}
						minLength={2}
						onChange={(event) => setName(event.target.value)}
						placeholder="Como te chamas?"
						value={name}
						required
					/>
				</div>
				<div>
					<label htmlFor="password">Palavra-passe</label>
					<input
						aria-describedby="password-hint"
						autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
						id="password"
						maxLength={128}
						minLength={8}
						onChange={(event) => setPassword(event.target.value)}
						type="password"
						value={password}
						required
					/>
					<p className="muted text-xs mt-2 mb-0" id="password-hint">
						Pelo menos 8 caracteres. Guarda-a para voltares a entrar.
					</p>
				</div>
				{error && (
					<p className="notice error" role="alert">
						{error}
					</p>
				)}
				<button className="button" disabled={busy} type="submit">
					{busy ? 'Só um instante…' : mode === 'register' ? 'Criar e começar →' : 'Entrar →'}
				</button>
			</form>
		</section>
	);
}
