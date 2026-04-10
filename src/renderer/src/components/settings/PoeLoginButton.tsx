import { useEffect, useState } from 'react'

export function PoeLoginButton(): JSX.Element {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)

  const checkAuth = (): void => {
    window.api.poeCheckAuth().then((r) => setLoggedIn(r.loggedIn))
  }

  useEffect(() => {
    checkAuth()
  }, [])

  if (loggedIn === null) return <span className="text-[11px] text-text-dim">Checking...</span>

  if (loggedIn) {
    return (
      <div className="setting-box">
        <span className="value text-accent">Logged in</span>
        <button
          className="primary"
          onClick={() => {
            window.api.poeLogout().then(() => setLoggedIn(false))
          }}
        >
          Logout
        </button>
      </div>
    )
  }

  return (
    <div className="setting-box">
      <span className="value text-text-dim">Not logged in</span>
      <button
        className="primary"
        onClick={() => {
          window.api.poeLogin().then(() => {
            setTimeout(checkAuth, 2000)
          })
        }}
      >
        Login
      </button>
    </div>
  )
}
