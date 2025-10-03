export default function Login() {
  return (
    <form style={{ maxWidth: 360 }} onSubmit={(e) => e.preventDefault()}>
      <h3>Login</h3>
      <div>
        <label>Username</label>
        <input type="text" name="username" required />
      </div>
      <div>
        <label>Password</label>
        <input type="password" name="password" required />
      </div>
      <button type="submit">Sign in</button>
    </form>
  )
}
