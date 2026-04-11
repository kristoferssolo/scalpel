export const FAQ: { section: string; items: { q: string; a: string }[] }[] = [
  {
    section: 'General Questions',
    items: [
      {
        q: "Is Scalpel compatible with GGG's Terms of Service?",
        a: 'Scalpel is an overlay that runs alongside PoE, not inside it. The only things it does to the game are: send a copy-to-clipboard request when you press the hotkey, edit your .filter file on disk, send /reloaditemfilter or /itemfilter commands when saving changes, and send whatever chat commands you bind in settings. It does not inject into the game, read game memory, or automate gameplay.',
      },
      { q: 'POE2 When', a: 'Stay tuned. I want to have it ready for 0.5' },
    ],
  },
  {
    section: 'Something Broke',
    items: [
      {
        q: "Scalpel doesn't detect my items / hotkey doesn't work",
        a: "If you run Path of Exile in elevated admin mode, you need to run Scalpel as administrator too. Right-click Scalpel.exe and select 'Run as administrator'.",
      },
      {
        q: "The overlay doesn't appear over my game",
        a: "Scalpel only works in Borderless Windowed or Windowed mode. Fullscreen is not supported. You can change this in PoE's graphics settings.",
      },
      {
        q: "I updated my filter online but Scalpel doesn't see the changes",
        a: "Click 'Check for Filter Updates' in the overlay header. This tells PoE to re-download the online filter, then Scalpel detects the change.",
      },
      {
        q: 'My filter changes were lost after updating',
        a: 'Starting from v0.7.4, Scalpel records your changes and replays them when you update. If you were on an older version, your first update after upgrading will reset your filter to the online version. Changes made after that are preserved.',
      },
      {
        q: "The 'Go to Hideout' button stopped working",
        a: 'The trade site login session expires after a while. Go to Settings > Trade site login and log in again to refresh it.',
      },
      {
        q: 'Bad currencies are still showing up after I hide them',
        a: 'Low level zones will still show bad currencies because they are in special tiers for leveling and Scalpel does not know the zone level you are in.',
      },
      {
        q: "I can't seem to update Scalpel",
        a: 'In some cases your antivirus may block the folder that the updates go to. Check that AppData/Roaming is not being blocked by AV. This has helped some people.',
      },
    ],
  },
  {
    section: 'Tips & Tricks',
    items: [
      {
        q: 'How do I use custom sound packs?',
        a: "Drop your .mp3 files into your filter folder (Documents/My Games/Path of Exile). They'll appear in the sound dropdown alongside built-in sounds when editing a filter block.",
      },
    ],
  },
]
