[](#title)
# 📊 Live Poll Demo

Real-time audience polling for GeekSlides

::: Notes
This deck demonstrates the live polling feature. Polls let you gather audience
responses in real-time during a presentation. Results are synchronized via
Yjs WebSocket — no external polling service needed.
:::

[](#how-it-works.mod-heading-center)
## How it works

1. Add the **`poll`** feature to your deck's `config.json`
2. Add the `.poll` class to any slide with a list
3. A **QR code** appears for the audience to scan and vote
4. **Freeze & reveal** the results as a live chart

::: Notes
The poll setup is minimal: add `poll` to your features list, then mark any slide
with the `.poll` class. The slide's unordered list items become the answer options.
A QR code is automatically generated so audience members can vote from their phones.
The `.poll-live` variant shows results updating in real-time as votes arrive.
:::

[](#q1.poll.poll-live)
## What is your favourite programming language?

- TypeScript
- Python
- Rust
- Go

::: Notes
This slide uses `.poll-live` — results update in real-time as votes come in.
The audience sees a QR code linking to a voting page. Each list item becomes a
clickable option. The chart animates as new votes are received via WebSocket.
:::

[](#q2.poll)
## How do you prefer to present slides?

- Web browser
- PDF / printed
- Terminal / CLI
- Dedicated app (Keynote, PowerPoint…)

::: Notes
This slide uses the basic `.poll` class (without `.poll-live`), meaning results
are hidden until the presenter explicitly freezes and reveals them. This creates
a suspenseful reveal moment. Each poll slide has its own independent vote tally.
:::

[](#q3.poll)
## How often do you run live polls in your talks?

- Never tried it
- Occasionally
- Regularly
- Every talk!

::: Notes
Multiple poll slides can exist in the same deck — each one tracks votes
independently. The poll state is persisted in the Yjs document, so late-joining
viewers see the current vote totals immediately.
:::

[](#thanks.mod-heading-center)
# Thanks for voting! 🎉

Powered by **GeekSlides** · Yjs · WebSockets

::: Notes
The `.mod-heading-center` modifier centers the heading both vertically and
horizontally. It works on any slide regardless of layout class. Combined here
with a simple thank-you message to close the deck.
:::
