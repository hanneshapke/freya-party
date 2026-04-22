import { useParams } from "react-router-dom";

export default function GuestParty() {
  const { joinCode } = useParams();
  return (
    <main className="min-h-screen bg-[#f5ead3] text-[#3a2e1f] p-8">
      <h1 className="text-3xl font-serif">Party {joinCode}</h1>
      <p className="mt-4 text-sm">Gäste-Flow wird in der nächsten Phase aus QuestGame.jsx migriert.</p>
    </main>
  );
}
