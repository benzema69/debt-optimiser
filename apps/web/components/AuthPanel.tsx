"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, hasSupabaseConfig } from "../lib/supabase";

export function AuthPanel({ session, onSession }:{ session:Session|null; onSession:(session:Session|null)=>void }){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  if(!hasSupabaseConfig()) return <section className="panel"><div className="panel-head"><div><span className="eyebrow">IDENTITY</span><h2>Local mode</h2></div></div><p className="muted">Supabase environment variables are not configured. The optimizer still works, but persistence is disabled.</p></section>;
  const client=getSupabase();
  if(!client) return null;

  async function signIn(){
    setBusy(true);setMessage(null);
    const {data,error}=await client!.auth.signInWithPassword({email,password});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    onSession(data.session);
  }
  async function signUp(){
    setBusy(true);setMessage(null);
    const {data,error}=await client!.auth.signUp({email,password});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    onSession(data.session);
    setMessage(data.session?"Account created.":"Account created. Check your email if confirmation is required.");
  }
  async function signOut(){
    setBusy(true);await client!.auth.signOut();setBusy(false);onSession(null);
  }

  if(session) return <section className="panel auth-panel"><div className="panel-head"><div><span className="eyebrow">IDENTITY</span><h2>Authenticated workspace</h2></div><span className="badge badge-ok">SYNC ENABLED</span></div><div className="auth-row"><div><span className="muted">Signed in as</span><b>{session.user.email ?? session.user.id}</b></div><button className="ghost" onClick={signOut} disabled={busy}>Sign out</button></div></section>;

  return <section className="panel auth-panel"><div className="panel-head"><div><span className="eyebrow">IDENTITY</span><h2>Secure workspace</h2></div><span className="badge">RLS PROTECTED</span></div><p className="muted">Sign in to persist codes and ledger events in your private Supabase rows. Anonymous mode remains local-only.</p><div className="auth-form"><input type="email" autoComplete="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/><button onClick={signIn} disabled={busy||!email||!password}>Sign in</button><button className="secondary" onClick={signUp} disabled={busy||!email||!password}>Create account</button></div>{message?<p className="muted">{message}</p>:null}</section>;
}
