import { useEffect, useRef } from 'react'
import { Crisp } from 'crisp-sdk-web'

interface CrispChatProps {
  userEmail?: string | null
  userName?: string | null
}

const CrispChat = ({ userEmail, userName }: CrispChatProps) => {
  const isConfigured = useRef(false)

  useEffect(() => {
    if (!isConfigured.current) {
      Crisp.configure('1875626e-05b7-44f9-b0d7-5d5085742010')
      isConfigured.current = true
    }

    // Set user info after Crisp is configured
    if (userEmail) {
      Crisp.user.setEmail(userEmail)
    }
    if (userName) {
      Crisp.user.setNickname(userName)
    }
  }, [userEmail, userName])

  return null
}

export default CrispChat
