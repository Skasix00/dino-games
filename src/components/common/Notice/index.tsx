import Link from 'next/link';

interface NoticeProps {
	message: string;
	onRetry?: () => void;
}

export default function Notice({ message, onRetry }: NoticeProps) {
	return (
		<div className="notice error" role="alert">
			<p>{message}</p>
			{onRetry && (
				<button className="button secondary" onClick={onRetry} type="button">
					Tentar novamente
				</button>
			)}
			<p className="mt-3 mb-0">
				<Link className="text-link" href="/player">
					Entrar no meu utilizador
				</Link>
			</p>
		</div>
	);
}
