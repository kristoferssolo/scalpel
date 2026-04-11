import { useState } from 'react'
import { CHANGELOG } from '../../../../shared/changelog'
import { FAQ } from '../../../../shared/faq'
import { Down, Right } from '@icon-park/react'
import { IP } from '../../shared/constants'
import { FaqItem } from './FaqItem'

export function FaqTab(): JSX.Element {
  const [changelogOpen, setChangelogOpen] = useState(false)

  return (
    <>
      <div className="mt-3 flex flex-col gap-3">
        {FAQ.map((section) => (
          <div key={section.section} className="flex flex-col gap-3">
            <div className="text-[10px] text-accent tracking-[1.5px] uppercase font-bold mt-1">{section.section}</div>
            {section.items.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        ))}
      </div>

      {/* Changelog */}
      <section>
        <div
          onClick={() => setChangelogOpen(!changelogOpen)}
          className="flex items-center gap-[6px] cursor-pointer select-none"
        >
          {changelogOpen ? <Down size={12} {...IP} /> : <Right size={12} {...IP} />}
          <span className="text-xs text-text-dim">Changelog</span>
        </div>
        {changelogOpen && (
          <div className="mt-2 flex flex-col gap-[10px]">
            {CHANGELOG.map((entry) => (
              <div key={entry.version}>
                <div className="text-[11px] font-semibold text-accent">v{entry.version}</div>
                <ul className="mt-1 ml-4 p-0 text-[11px] text-text-dim">
                  {entry.notes.map((note, i) => (
                    <li key={i} className="mt-0.5">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
