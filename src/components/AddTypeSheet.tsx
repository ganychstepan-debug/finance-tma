import { haptic } from '@/lib/telegram'

export type AddType = 'expense' | 'income' | 'transfer'

interface Props {
  onChoose: (type: AddType) => void
  onClose: () => void
}

export const AddTypeSheet: React.FC<Props> = ({ onChoose, onClose }) => {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/70 flex items-end z-[60] animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-bg-secondary rounded-t-3xl px-5 pt-5 pb-8 animate-slide-up"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
      >
        <div className="w-10 h-1 bg-bg-tertiary rounded-full mx-auto mb-4" />

        <div className="text-sm font-medium text-center mb-5">Что добавить?</div>

        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={() => { haptic.medium(); onChoose('expense') }}
            className="py-5 border-0 rounded-2xl text-white cursor-pointer flex flex-col items-center gap-2 active:scale-95 transition-transform"
            style={{ background: '#141414', border: '0.5px solid #222' }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ff1744" strokeWidth="2.4" strokeLinecap="round">
              <path d="M5 12h14" />
            </svg>
            <span className="text-xs font-medium">Расход</span>
          </button>

          <button
            onClick={() => { haptic.medium(); onChoose('income') }}
            className="py-5 border-0 rounded-2xl text-white cursor-pointer flex flex-col items-center gap-2 active:scale-95 transition-transform"
            style={{ background: '#141414', border: '0.5px solid #222' }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#00c864" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="text-xs font-medium">Доход</span>
          </button>

          <button
            onClick={() => { haptic.medium(); onChoose('transfer') }}
            className="py-5 border-0 rounded-2xl text-white cursor-pointer flex flex-col items-center gap-2 active:scale-95 transition-transform"
            style={{ background: '#141414', border: '0.5px solid #222' }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 10h10M13 6l4 4-4 4" />
              <path d="M17 14H7M11 18l-4-4 4-4" />
            </svg>
            <span className="text-xs font-medium">Перевод</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-3.5 bg-transparent border-0 text-text-muted text-sm cursor-pointer"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}
