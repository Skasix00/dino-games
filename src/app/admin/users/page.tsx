'use client';
import { useEffect, useState } from 'react';

import { api, errorMessage } from '@/utils/api';

interface User { _id: string; displayName: string; createdAt: string; sessionCount: number }

export default function AdminUsers() {
	const [users, setUsers] = useState<User[]>([]);
	const [error, setError] = useState('');
	useEffect(() => {
		void api<{ users: User[] }>('admin/users')
			.then((value) => setUsers(value.users))
			.catch((value) => setError(errorMessage(value)));
	}, []);

	async function remove(user: User) {
		if (
			window.prompt(`Escreve exatamente «${user.displayName}» para apagar este utilizador.`) !==
			user.displayName
		)
			{return;}
		try {
			await api('admin/users', { playerId: user._id, displayName: user.displayName }, 'DELETE');
			setUsers((current) => current.filter((item) => item._id !== user._id));
		} catch (value) {
			setError(errorMessage(value));
		}
	}

	return (
		<main className="page-container">
			<section className="panel stack">
				<p className="eyebrow">MODERAÇÃO</p>
				<h1 className="page-heading">Utilizadores</h1>
				{error && (
					<p className="notice error" role="alert">
						{error}
					</p>
				)}
				<div className="stack">
					{users.map((user) => (
						<article key={user._id} className="notice">
							<strong>{user.displayName}</strong>
							<p className="muted">
								{user.sessionCount} partidas ·{' '}
								{new Date(user.createdAt).toLocaleDateString('pt-PT')}
							</p>
							<button className="button secondary" onClick={() => void remove(user)} type="button">
								Apagar utilizador
							</button>
						</article>
					))}
				</div>
			</section>
		</main>
	);
}
