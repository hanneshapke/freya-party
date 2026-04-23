import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";

import { hostApi } from "../lib/api.js";

export default function BillingReturn() {
  const { getToken } = useAuth();
  const [me, setMe] = useState(null);

  useEffect(() => {
    let cancelled = false;
    hostApi(getToken)
      .me()
      .then((user) => !cancelled && setMe(user))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  return (
    <main className="min-h-screen bg-[#f5ead3] text-[#3a2e1f] p-8">
      <h1 className="text-3xl font-serif mb-4">Danke für dein Abo!</h1>
      <p className="mb-6">
        Status: <strong>{me?.subscription_status ?? "wird aktualisiert..."}</strong>
      </p>
      <Link to="/dashboard" className="underline">
        Zum Dashboard
      </Link>
    </main>
  );
}
