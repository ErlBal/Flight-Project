export default function Register() {
  return (
    <form style={{ maxWidth: 360 }} onSubmit={(e) => e.preventDefault()}>
      <h3>Sign up</h3>
      <div>
        <label>Email</label>
        <input type="email" name="email" required />
      </div>
      <div>
        <label>Full name</label>
        <input type="text" name="full_name" required />
      </div>
      <div>
        <label>Password</label>
        <input type="password" name="password" required />
      </div>
      <button type="submit">Create account</button>
    </form>
  )
}
