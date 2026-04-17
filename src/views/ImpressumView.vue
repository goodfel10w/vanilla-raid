<template>
  <article id="v-impressum" class="legal-page">
    <h2 class="legal-heading">Impressum</h2>

    <section>
      <h3>Angaben nach § 18 Abs. 2 MStV</h3>
      <p>Denis Lischer</p>
    </section>

    <section>
      <h3>Kontakt</h3>
      <p>E-Mail: denislischer@hotmail.com</p>
    </section>

    <section>
      <h3>Hinweis</h3>
      <p>
        Bei dieser Website handelt es sich um ein privates, nicht-kommerzielles
        Gemeinschaftsprojekt einer World-of-Warcraft-Gilde. Es werden keine
        Waren oder Dienstleistungen angeboten.
      </p>
    </section>

    <section>
      <h3>Haftung für Inhalte</h3>
      <p>
        Die Inhalte dieser Seite wurden mit größter Sorgfalt erstellt.
        Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte
        kann jedoch keine Gewähr übernommen werden.
      </p>
    </section>

    <section>
      <h3>Haftung für Links</h3>
      <p>
        Diese Website enthält Links zu externen Webseiten Dritter, auf deren
        Inhalte kein Einfluss besteht. Für die Inhalte der verlinkten Seiten
        ist stets der jeweilige Anbieter oder Betreiber verantwortlich.
        Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche
        Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt
        der Verlinkung nicht erkennbar.
      </p>
    </section>

    <section>
      <h3>Urheberrecht</h3>
      <p>
        World of Warcraft und Blizzard Entertainment sind Marken oder
        eingetragene Marken von Blizzard Entertainment, Inc. in den USA
        und/oder anderen Ländern. Diese Website ist nicht von Blizzard
        Entertainment genehmigt oder wird von ihr betrieben.
      </p>
    </section>

    <div class="legal-footer">
      <router-link to="/datenschutz">Datenschutzerklärung</router-link>
    </div>
  </article>
</template>

<style scoped>
.legal-page {
  max-width: 680px;
}

.legal-heading {
  font: 700 22px var(--font-heading);
  color: var(--color-gold);
  margin: 0 0 24px;
}

section {
  margin-bottom: 24px;
}

h3 {
  font: 600 15px var(--font-body);
  color: var(--color-tx);
  margin: 0 0 8px;
}

p {
  font: 400 14px/1.7 var(--font-body);
  color: var(--color-tx2);
  margin: 0;
}

.legal-footer {
  margin-top: 40px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.legal-footer a {
  font: 400 13px var(--font-body);
  color: var(--color-gold);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.legal-footer a:hover {
  color: var(--color-gold-light);
}
</style>
