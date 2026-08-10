import cron from 'node-cron'
import { runMonthlyVoteJob } from './albumOfMonth.js'

// Job horário do álbum do mês: gera candidatos quando a votação abre (última
// semana do mês) e apura votações cujo prazo de divulgação já passou. Como o
// server pode ficar pausado (Railway free), as rotas também resolvem sob
// demanda (lazy) — este job só adianta o trabalho para o horário certo.
export function startScheduledJobs(): void {
  cron.schedule(
    '5 * * * *',
    () => {
      runMonthlyVoteJob().catch((err) => {
        console.error('[cron] falha no job do álbum do mês:', err)
      })
    },
    { timezone: 'UTC' },
  )
  console.log('[cron] job horário do álbum do mês agendado.')
}
