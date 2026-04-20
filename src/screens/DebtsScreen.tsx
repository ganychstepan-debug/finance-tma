import { useState } from 'react'
import { useStore } from '@/store'
import { formatMoney, formatDate } from '@/lib/formatters'
import { haptic } from '@/lib/telegram'
import type { DebtDirection, Currency } from '@/types'

export const DebtsScreen: React.FC = () => {
  const { debts, addDebt, updateDebt, deleteDebt } = useStore()
  const [tab, setTab] = useState<DebtDirection>('owe')
  const [creating, setCreating] = useState(false)

  // Форма
  const [counterparty, setCounterparty] = useState('')
  const [amount, setAmount]             = useState('')
  const [currency, setCurrency]         = useState<Currency>('RUB')
  const [comment, setComment]           = useState('')

  const filtered = debts
    .filter((d) => d.direction === tab && d.status === 'active')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = filtered.reduce((sum, d) => sum + d.amount, 0)

  const canSave = counterparty.trim().length > 0 && Number(amount) > 0

  const save = () => {
    if (!canSave) return
    haptic.success()
    addDebt({
      direction: tab,
      counterparty: counterparty.trim(),
      amount: Number(amount),
      currency,
      startDate: new Date().toISOString(),
      comment: comment.trim() || undefined,
      status: 'active',
    })
    setCounterparty('')
    setAmount('')
    setComment('')
    setCreating(false)
  }

  const markPaid = (id: string) => {
    haptic.success()
    updateDebt(id, { status: 'paid' })
  }

  const remove = (id: string) => {
    if (!window.confirm('Удалить запись?')) return
    haptic.warning()
    deleteDebt(id)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-4">
      <div className="px-5 pt-3 pb-4 flex justify-between items-center">
        <div className="text-xl font-medium">Долги</div>
        <button
          onClick={() => { haptic.light(); setCreating(!creating) }}
          className="text-xs text-accent bg-transparent border-0 cursor-pointer"
        >
          {creating ? 'Отмена' : '+ Новый долг'}
        </button>
      </div>

      {/* Таб-переключатель */}
      <div className="px-5 mb-4 flex gap-1.5">
        <button
          onClick={() => { haptic.select(); setTab('owe') }}
          className={`flex-1 py-2 rounded-btn text-xs font-medium cursor-pointer border-0 ${
            tab === 'owe' ? 'bg-accent text-white' : 'bg-transparent border border-border text-text-muted'
          }`}
        >
          Я должен
        </button>
        <button
          onClick={() => { haptic.select(); setTab('owed') }}
          className={`flex-1 py-2 rounded-btn text-xs font-medium cursor-pointer border-0 ${
            tab === 'owed' ? 'bg-accent text-white' : 'bg-transparent border border-border text-text-muted'
          }`}
        >
          Мне должны
        </button>
      </div>

      {/* Сводка */}
      {filtered.length > 0 && (
        <div className="px-5 mb-4">
          <div className="text-2xs text-text-muted uppercase tracking-wide mb-1">
            {tab === 'owe' ? 'Всего к возврату' : 'Всего к получению'}
          </div>
          <div className="text-2xl font-light">
            {Math.round(total).toLocaleString('ru-RU')} <span className="text-text-muted">₽</span>
          </div>
        </div>
      )}

      {/* Форма создания */}
      {creating && (
        <div className="mx-5 mb-4 p-4 bg-bg-secondary border border-border rounded-card space-y-3 animate-slide-up">
          <input
            type="text"
            placeholder={tab === 'owe' ? 'Кому должен?' : 'Кто должен?'}
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            maxLength={40}
            className="w-full px-3 py-2.5 bg-bg-primary border border-border rounded-btn text-white text-sm box-border"
          />
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              placeholder="Сумма"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 px-3 py-2.5 bg-bg-primary border border-border rounded-btn text-white text-sm box-border"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="px-3 py-2.5 bg-bg-primary border border-border rounded-btn text-white text-sm cursor-pointer"
            >
              <option value="RUB">₽</option>
              <option value="USD">$</option>
              <option value="EUR">€</option>
              <option value="KZT">₸</option>
              <option value="BYN">Br</option>
              <option value="UAH">₴</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Комментарий (не обязательно)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={100}
            className="w-full px-3 py-2.5 bg-bg-primary border border-border rounded-btn text-white text-sm box-border"
          />
          <button
            onClick={save}
            disabled={!canSave}
            className={`w-full py-3 border-0 rounded-btn text-white text-sm font-medium cursor-pointer ${
              canSave ? 'bg-accent' : 'bg-bg-tertiary text-text-faint'
            }`}
          >
            Добавить
          </button>
        </div>
      )}

      {/* Список */}
      <div className="px-5 space-y-2.5">
        {filtered.length === 0 && !creating ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">{tab === 'owe' ? '💸' : '💰'}</div>
            <div className="text-sm text-text-secondary">
              {tab === 'owe' ? 'Ты никому не должен' : 'Никто не должен тебе'}
            </div>
          </div>
        ) : (
          filtered.map((d) => (
            <div key={d.id} className="p-3.5 bg-bg-secondary border border-border rounded-card">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{d.counterparty}</div>
                  {d.comment && (
                    <div className="text-xs text-text-muted truncate mt-0.5">{d.comment}</div>
                  )}
                  <div className="text-xs text-text-muted mt-0.5">
                    с {formatDate(d.startDate)}
                  </div>
                </div>
                <div className={`text-base font-medium shrink-0 ml-3 ${tab === 'owe' ? 'text-accent' : 'text-success'}`}>
                  {formatMoney(d.amount, d.currency).replace('−', '')}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => markPaid(d.id)}
                  className="flex-1 py-2 bg-accent border-0 rounded-btn text-white text-xs font-medium cursor-pointer"
                >
                  {tab === 'owe' ? 'Вернул' : 'Получил'}
                </button>
                <button
                  onClick={() => remove(d.id)}
                  className="px-3 py-2 bg-transparent border border-border rounded-btn text-text-muted text-xs cursor-pointer"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
