export default function SignOutPage() {
  return <main style={{maxWidth:420,margin:"80px auto",padding:24,fontFamily:"system-ui"}}><h1>Sign out</h1><form action="/api/auth/signout" method="post"><button type="submit">Sign out of your account</button></form><p><a href="/portal">Return to portal</a></p></main>;
}
