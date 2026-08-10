import { Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { QuizDetailPage } from './pages/QuizDetailPage'
import { QuizListPage } from './pages/QuizListPage'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<QuizListPage />} />
      <Route path="/quizzes/:id" element={<QuizDetailPage />} />
    </Routes>
  )
}
