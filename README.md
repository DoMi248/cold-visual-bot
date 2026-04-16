# cold-visual-bot

Discord-Bot für Produkt-/Preislisten, Ticket-Abwicklung und PSC-Verarbeitung.

## Commands

> Prefix ist standardmäßig `!` (konfigurierbar über `COMMAND_PREFIX`).
> Wenn ein User nur `!` schreibt, zeigt der Bot die für seine Rolle verfügbaren Chat-Befehle an.

### Pricelist

- `!pricelist`  
  Sendet die aktuelle Pricelist als Embed (in den konfigurierten Pricelist-Channel oder in den aktuellen Channel).

### Produktverwaltung

- `!product help`  
  Zeigt die Hilfe für Produktverwaltung.
- `!product list`  
  Listet alle Produkte.
- `!product add <id> <preis> <name>`  
  Erstellt ein neues Produkt oder überschreibt ein bestehendes mit derselben ID.
- `!product setprice <id> <preis>`  
  Ändert den Preis eines Produkts.
- `!product rename <id> <name>`  
  Ändert den Namen eines Produkts.
- `!product remove <id>`  
  Löscht ein Produkt.

Alias für `product`: `products`, `pack`, `packs`

### Paysafecard-Verwaltung

- `!psc help`  
  Zeigt die Hilfe für PSC-Befehle.
- `!psc list [limit]`  
  Listet die letzten gespeicherten PSC-Einträge (max. 20).
- `!psc show [ticketChannelId]`  
  Zeigt den neuesten PSC-Eintrag für einen Ticket-Channel (inkl. entschlüsseltem Code, nur für berechtigte User).

### Wartezimmer-Musik

- `!wartemusik help`  
  Zeigt die Hilfe für Musik-Befehle.
- `!wartemusik join [voiceChannelId]`  
  Lässt den Bot einem Talk beitreten und den aktuell ausgewählten Track abspielen.
- `!wartemusik leave`  
  Stoppt die Musik und lässt den Bot den Talk verlassen.
- `!wartemusik status`  
  Zeigt den aktuellen Status der Wartezimmer-Musik.
- `!wartemusik list`  
  Zeigt alle lokal hinterlegten Tracks.
- `!wartemusik switch <trackName|nummer>`  
  Wechselt auf einen anderen Track.
- `!wartemusik next` / `!wartemusik prev`  
  Wechselt zum nächsten/vorherigen Track.

- **Auto-Begrüßung:** Bei jedem Join in `MUSIC_WAITING_ROOM_CHANNEL_ID` spielt der Bot automatisch den aktuell ausgewählten Track im Warteraum.

Alias für `wartemusik`: `music`, `waitmusic`

## Level-System

- Jeder User sammelt beim Schreiben XP (mit kurzer Anti-Spam-Cooldown-Zeit).
- Bei einem Level-Up postet der Bot ausschließlich im konfigurierten `LEVEL_UP_CHANNEL_ID`.

## Ticket-/Kauf-Flow

- Käufer wählt Paket über Dropdown aus.
- Bei PSC wird ein Ticket erstellt und der PSC-Code verschlüsselt gespeichert.
- **Neu:** Bei jedem PSC-Kauf wird automatisch die Ticket-Channel-ID plus verschlüsselter Code in den konfigurierten Encrypt-Channel gepostet.
- **Neu:** Käufer können eine Schließung anfragen, dabei öffnet sich automatisch ein Bewertungsfenster (1-5 Sterne + Text) und die Bewertung wird in den Review-Channel gepostet.
- **Neu:** Admins können die Schließung erzwingen, das Ticket bleibt danach 24h für die Bewertung sichtbar und wird anschließend automatisch gelöscht.
- **Neu:** Beim Erzwingen der Schließung eines Tickets wird automatisch ein Transcript erstellt:
  - Post im konfigurierten Transcript-Channel
  - Versand als DM an den Käufer (Ticket-Owner)

## .env Konfiguration

```env
DISCORD_TOKEN=
GUILD_ID=
PRICELIST_CHANNEL_ID=
TICKET_TRANSCRIPT_CHANNEL_ID=
PSC_ENCRYPT_CHANNEL_ID=
TICKET_REVIEW_CHANNEL_ID=
LEVEL_UP_CHANNEL_ID=
COMMAND_PREFIX=!
PAYPAL_URL=https://paypal.me/your-paypal-link
PSC_ENCRYPTION_KEY=change-me-to-a-long-random-secret
MUSIC_STREAM_URL=
MUSIC_DEFAULT_VOICE_CHANNEL_ID=
MUSIC_WAITING_ROOM_CHANNEL_ID=
MUSIC_TRACKS=welcome-1.mp3,welcome-2.mp3
MUSIC_AUDIO_DIR=src/data/audio
```

### Erklärung der neuen Variablen

- `TICKET_TRANSCRIPT_CHANNEL_ID`  
  Ziel-Channel für Ticket-Transcripts.
- `PSC_ENCRYPT_CHANNEL_ID`  
  Ziel-Channel für PSC-Encrypt-Logs (Channel-ID + verschlüsselter Code).
- `TICKET_REVIEW_CHANNEL_ID`  
  Ziel-Channel für Käufer-Bewertungen (Sterne + Text).
- `LEVEL_UP_CHANNEL_ID`  
  Ziel-Channel für Level-Up-Nachrichten.
- `MUSIC_STREAM_URL`  
  HTTP/HTTPS-Audioquelle für den Wartezimmer-Musikbot.
- `MUSIC_DEFAULT_VOICE_CHANNEL_ID`  
  Optionaler Standard-Talk, falls bei `join` kein Channel übergeben wurde und der Ausführende in keinem Talk ist.
- `MUSIC_WAITING_ROOM_CHANNEL_ID`  
  Voice-Channel-ID des Warteraums. Bei jedem Join wird dort automatisch Begrüßungs-Audio abgespielt.
- `MUSIC_TRACKS`  
  Komma-separierte Liste von Dateinamen aus `MUSIC_AUDIO_DIR` (z. B. `welcome-1.mp3,welcome-2.mp3`).
- `MUSIC_AUDIO_DIR`  
  Ordner mit lokal hinterlegten Audio-Dateien für den Musikbot.
