import { ArrowRight, CheckCircle2, Languages, Library, WandSparkles } from "lucide-react"

import { FeatureIntro } from "@/components/feature-intro"
import { LanguageLab } from "@/features/advanced/language-lab"
import { buttonVariants } from "@/components/ui/button"

const languageIntroPoints = [
  { title: "Scan liked songs", description: "Check your saved tracks for recognised language patterns." },
  { title: "Pick a language", description: "Choose one detected group after reviewing the results." },
  { title: "Create the playlist", description: "Save the selected language group to Spotify." },
]

export function LanguagePlaylistsPage() {
  return (
    <div className="container space-y-8 py-8 md:py-12">
      <section className="section-shell animate-fade-up overflow-hidden">
        <FeatureIntro
          eyebrow="Language Playlists Beta"
          icon={Languages}
          points={languageIntroPoints}
          title="Create playlists from the languages in your liked songs."
          visual={
            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <Library className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Step 1</p>
                    <p className="font-semibold text-foreground">Scan liked songs</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center text-primary">
                <ArrowRight className="h-5 w-5" />
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <WandSparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Step 2</p>
                    <p className="font-semibold text-foreground">Pick a detected language</p>
                  </div>
                </div>
                <div className="grid gap-2">
                  {["IT", "EN", "FA"].map((language) => (
                    <div key={language} className="flex items-center justify-between rounded-2xl border border-white/10 bg-background/35 px-3 py-2">
                      <span className="text-sm font-semibold text-foreground">{language}</span>
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center text-primary">
                <ArrowRight className="h-5 w-5" />
              </div>

              <div className="rounded-3xl border border-primary/20 bg-primary/8 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <Languages className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Step 3</p>
                    <p className="font-semibold text-foreground">Create the playlist</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  The selected language group becomes a playlist in your connected Spotify account.
                </p>
              </div>
            </div>
          }
        >
          <p className="text-base text-muted-foreground md:text-lg">
            This beta scanner checks your liked songs, groups the languages it recognises, and lets you choose the
            language you want to turn into a Spotify playlist.
          </p>
          <p className="text-base text-muted-foreground md:text-lg">
            It uses the Python <span className="font-semibold text-foreground">langdetect</span> library. For each
            song, the backend combines the track title with the artist names, asks langdetect for the most likely
            language code, and skips songs where the text is too short or unclear to classify.
          </p>
          <p className="text-base text-muted-foreground md:text-lg">
            Because song titles and artist names can be mixed-language or stylized, treat the result as a helpful
            starting point and give the selected group a quick check before creating the playlist.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#language-lab" className={buttonVariants({ variant: "secondary" })}>
              Open language builder
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </FeatureIntro>
      </section>

      <LanguageLab />
    </div>
  )
}
