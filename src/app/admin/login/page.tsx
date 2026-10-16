'use client';
import type { FormEvent } from 'react';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api, errorMessage } from '@/utils/api';
export default function AdminLogin() {
	const router = useRouter();
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');

	async function submit(event: FormEvent) {
		event.preventDefault();
		setError('');
		try {
			await api('admin/login', { username, password });
			router.push('/admin/users');
		} catch (value) {
			setError(errorMessage(value));
		}
	}

	return (
		<main className="page-container">
			<section className="panel narrow stack">
				<p className="eyebrow">MODERAÇÃO</p>
				<h1 className="page-heading">Área de administrador</h1>
				<form className="stack" onSubmit={submit}>
					<label htmlFor="admin-username">Utilizador</label>
					<input
						autoComplete="username"
						id="admin-username"
						onChange={(event) => setUsername(event.target.value)}
						value={username}
						required
					/>
					<label htmlFor="admin-password">Palavra-passe</label>
					<input
						autoComplete="current-password"
						id="admin-password"
						onChange={(event) => setPassword(event.target.value)}
						type="password"
						value={password}
						required
					/>
					{error && (
						<p className="notice error" role="alert">
							{error}
						</p>
					)}
					<button className="button" type="submit">
						Entrar
					</button>
				</form>
			</section>
		</main>
	);
}
