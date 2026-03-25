import "./MessageCard.css";
type MessageCardProps = {
  title: string;
  message: string;
  tone?: "info" | "error";
};

export default function MessageCard({ title, message, tone = "info" }: MessageCardProps) {
  return (
    <article className={`card message-card ${tone}`}>
      <h3>{title}</h3>
      <p>{message}</p>
    </article>
  );
}
