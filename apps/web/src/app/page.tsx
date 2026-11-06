import ja from "@/messages/ja.json";

export default function HomePage() {
  return (
    <main>
      <h1>{ja.app.title}</h1>
      <p>{ja.app.description}</p>
    </main>
  );
}
