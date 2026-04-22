import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";

import Landing from "./routes/Landing.jsx";
import BillingReturn from "./routes/BillingReturn.jsx";
import HostDashboard from "./routes/host/Dashboard.jsx";
import HostPartyEditor from "./routes/host/PartyEditor.jsx";
import HostPartySubmissions from "./routes/host/PartySubmissions.jsx";
import GuestParty from "./routes/guest/GuestParty.jsx";

function Protected({ children }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/p/:joinCode" element={<GuestParty />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <HostDashboard />
            </Protected>
          }
        />
        <Route
          path="/parties/:id/edit"
          element={
            <Protected>
              <HostPartyEditor />
            </Protected>
          }
        />
        <Route
          path="/parties/:id/submissions"
          element={
            <Protected>
              <HostPartySubmissions />
            </Protected>
          }
        />
        <Route
          path="/billing/return"
          element={
            <Protected>
              <BillingReturn />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
