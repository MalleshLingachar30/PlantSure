import type { CSSProperties } from 'react'

export type VisitState = 'done' | 'overdue' | 'due' | 'scheduled' | 'waived'
export type CheckState = VisitState

export type VisitTimelineEntry =
  | VisitState
  | {
      state: VisitState
      label?: string
    }

const YEARS = 5
const PER_YEAR = 4
const TOTAL_VISITS = YEARS * PER_YEAR

export const plantSureStorySequence: VisitState[] = [
  'done',
  'done',
  'done',
  'done',
  'done',
  'done',
  'done',
  'done',
  'done',
  'overdue',
  'overdue',
  'overdue',
  'overdue',
  'overdue',
  'overdue',
  'overdue',
  'overdue',
  'overdue',
  'overdue',
  'overdue',
]

const stateCopy: Record<VisitState, { label: string }> = {
  done: { label: 'Checked' },
  overdue: { label: 'No one visited' },
  due: { label: 'Due now' },
  scheduled: { label: 'Scheduled' },
  waived: { label: 'Not required' },
}

function normalizeEntry(entry: VisitTimelineEntry | undefined): {
  state: VisitState
  label: string
} {
  if (!entry) {
    return { state: 'scheduled', label: stateCopy.scheduled.label }
  }

  if (typeof entry === 'string') {
    return { state: entry, label: stateCopy[entry].label }
  }

  return { state: entry.state, label: entry.label ?? stateCopy[entry.state].label }
}

function normalizeSequence(sequence: VisitTimelineEntry[]) {
  return Array.from({ length: TOTAL_VISITS }, (_, index) =>
    normalizeEntry(sequence[index]),
  )
}

function dotStyle(state: VisitState): CSSProperties {
  if (state === 'done') {
    return { background: 'var(--alive)' }
  }

  if (state === 'overdue') {
    return {
      background: 'var(--overdue)',
      boxShadow: '0 0 0 4px var(--overdue-bg)',
    }
  }

  if (state === 'due') {
    return {
      border: '1.5px solid var(--ink-faint)',
      background:
        'linear-gradient(90deg, var(--ink-faint) 0 50%, transparent 50% 100%)',
    }
  }

  if (state === 'waived') {
    return {
      border: '1.5px solid var(--rule-strong)',
      background:
        'linear-gradient(135deg, transparent 0 43%, var(--ink-faint) 43% 57%, transparent 57% 100%)',
    }
  }

  return {
    border: '1.5px solid var(--rule-strong)',
    background: 'transparent',
  }
}

function VisitDot({
  state,
  label,
  index,
}: {
  state: VisitState
  label: string
  index: number
}) {
  return (
    <span
      role="img"
      aria-label={`Year ${Math.floor(index / PER_YEAR) + 1}, check ${
        (index % PER_YEAR) + 1
      }: ${label}`}
      className="block h-[13px] w-[13px] shrink-0 rounded-full"
      style={dotStyle(state)}
    />
  )
}

function Connector({ filled }: { filled: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="mx-0 block h-[1.5px] w-3.5 shrink-0"
      style={{
        background: filled ? 'var(--alive)' : 'var(--rule-strong)',
        opacity: filled ? 0.4 : 1,
      }}
    />
  )
}

function LegendDot({ state }: { state: VisitState }) {
  return (
    <span
      className="block h-2.5 w-2.5 shrink-0 rounded-full"
      style={dotStyle(state)}
      aria-hidden="true"
    />
  )
}

export function VisitTimeline({
  sequence = plantSureStorySequence,
  showLegend = true,
  caption,
  labelledBy,
}: {
  sequence?: VisitTimelineEntry[]
  showLegend?: boolean
  caption?: string
  labelledBy?: string
}) {
  const visits = normalizeSequence(sequence)
  const counts = visits.reduce(
    (acc, visit) => {
      acc[visit.state] += 1
      return acc
    },
    {
      done: 0,
      overdue: 0,
      due: 0,
      scheduled: 0,
      waived: 0,
    } satisfies Record<VisitState, number>,
  )
  const years = Array.from({ length: YEARS }, (_, yearIndex) =>
    visits.slice(yearIndex * PER_YEAR, (yearIndex + 1) * PER_YEAR),
  )

  return (
    <figure aria-labelledby={labelledBy}>
      <ol className="flex flex-wrap gap-x-7 gap-y-5">
        {years.map((checks, yearIndex) => (
          <li key={yearIndex} className="flex min-w-[96px] flex-col gap-2.5">
            <span className="eyebrow">Year {yearIndex + 1}</span>
            <ol
              className="flex h-[17px] items-center"
              aria-label={`Year ${yearIndex + 1}`}
            >
              {checks.map((visit, checkIndex) => {
                const index = yearIndex * PER_YEAR + checkIndex
                const previous = checks[checkIndex - 1]
                const connectorFilled =
                  previous?.state === 'done' && visit.state === 'done'

                return (
                  <li key={index} className="flex items-center">
                    {checkIndex > 0 && <Connector filled={connectorFilled} />}
                    <VisitDot
                      state={visit.state}
                      label={visit.label}
                      index={index}
                    />
                  </li>
                )
              })}
            </ol>
          </li>
        ))}
      </ol>

      <p className="sr-only">
        Twenty scheduled checks over five years. {counts.done} recorded,{' '}
        {counts.overdue} overdue, {counts.due} due now, {counts.scheduled}{' '}
        scheduled, and {counts.waived} not required.
      </p>

      {caption && (
        <figcaption className="body-copy mt-6 text-[14px]">
          {caption}
        </figcaption>
      )}

      {showLegend && (
        <div
          className="mt-6 flex flex-wrap gap-x-6 gap-y-2.5 border-t pt-5"
          style={{ borderColor: 'var(--rule)' }}
          aria-label="Timeline key"
        >
          {(['done', 'overdue', 'due', 'scheduled', 'waived'] as VisitState[]).map(
            (state) => (
              <span
                key={state}
                className="inline-flex items-center gap-2 text-[13px]"
                style={{ color: 'var(--ink-soft)' }}
              >
                <LegendDot state={state} />
                {stateCopy[state].label}
              </span>
            ),
          )}
        </div>
      )}
    </figure>
  )
}
