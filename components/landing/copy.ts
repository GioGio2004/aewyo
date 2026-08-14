export type LocalizedString = { ka: string; en: string };

export const copy = {
  nav: {
    signIn: { ka: "შესვლა", en: "Sign in" },
    openApp: { ka: "აპის გახსნა", en: "Open app" },
  },
  hero: {
    title: {
      ka: "შენი ნახაზი და დიზაინი უკვე აეწყო",
      en: "Your drawings and design — already assembled",
    },
    sub: {
      ka: "დიზაინი კლიენტის ნამდვილ კედელზე ჩნდება კონსულტაციის დროსვე, ზუსტი ნახაზები კი მზადაა საათებში — და არა კვირებში.",
      en: "The design appears on the client's real wall during the consultation — and precise drawings are ready in hours, not weeks.",
    },
    cta: { ka: "დაიწყე პროექტი", en: "Start a project" },
    secondary: { ka: "როგორ მუშაობს", en: "How it works" },
  },
  how: {
    title: { ka: "როგორ მუშაობს", en: "How it works" },
    steps: [
      {
        num: "01",
        title: { ka: "დიზაინი", en: "Design" },
        body: {
          ka: "AI ავეჯს კლიენტის ნამდვილი კედლის ფოტოზე გამოსახავს — პირდაპირ კონსულტაციაზე.",
          en: "AI renders the furniture on the client's real wall photo — live at the consultation.",
        },
      },
      {
        num: "02",
        title: { ka: "ზომები", en: "Measurements" },
        body: {
          ka: "პარტნიორი ადგილზე იღებს ზუსტ ზომებს იმავე პროექტში.",
          en: "The partner takes exact site measurements into the same project.",
        },
      },
      {
        num: "03",
        title: { ka: "ნახაზი", en: "Drawings" },
        body: {
          ka: "ძრავი ქმნის უზადო, დაზომილ ნახაზებს და საჭრელ სიებს — იმავე დღეს.",
          en: "The engine produces flawless dimensioned drawings and cut lists — the same day.",
        },
      },
    ],
  },
  why: {
    title: { ka: "რატომ aewyo", en: "Why aewyo" },
    values: [
      {
        title: { ka: "საათები და არა კვირები", en: "Hours, not weeks" },
        body: {
          ka: "რენდერი კონსულტაციაზე, ნახაზი იმავე დღეს.",
          en: "A render at the consultation, drawings the same day.",
        },
      },
      {
        title: { ka: "მილიმეტრული სიზუსტე", en: "Millimeter precision" },
        body: {
          ka: "დეტერმინისტული ძრავი — არანაირი ვარაუდი.",
          en: "A deterministic engine — no guesswork.",
        },
      },
      {
        title: {
          ka: "დამზადებულია ხელოსნების მიერ",
          en: "Built by woodworkers",
        },
        body: {
          ka: "წესები სახელოსნოდან მოდის და არა ქაღალდიდან.",
          en: "The rules come from the workshop floor, not from paper.",
        },
      },
    ],
  },
  band: {
    line: {
      ka: "მზად ხარ? პირველი ნახაზი დღესვე.",
      en: "Ready? Your first drawing today.",
    },
    cta: { ka: "დაიწყე პროექტი", en: "Start a project" },
  },
  appStub: {
    line: {
      ka: "სამუშაო სივრცე მალე გაიხსნება.",
      en: "The workspace opens soon.",
    },
    back: { ka: "მთავარ გვერდზე დაბრუნება", en: "Back to the home page" },
  },
  studio: {
    title: { ka: "სტუდია", en: "Studio" },
    params: { ka: "პარამეტრები", en: "Parameters" },
    fields: {
      width: { ka: "სიგანე", en: "Width" },
      height: { ka: "სიმაღლე", en: "Height" },
      depth: { ka: "სიღრმე", en: "Depth" },
      thickness: { ka: "მასალის სისქე", en: "Material thickness" },
      backThickness: { ka: "ზურგის სისქე", en: "Back thickness" },
      shelfCount: { ka: "თაროების რაოდენობა", en: "Shelves" },
      plinthHeight: { ka: "ცოკოლის სიმაღლე", en: "Plinth height" },
      shelfSetback: { ka: "თაროს უკუწევა", en: "Shelf setback" },
    },
    drawing: { ka: "ნახაზი", en: "Drawing" },
    cutList: { ka: "საჭრელი სია", en: "Cut list" },
    table: {
      part: { ka: "დეტალი", en: "Part" },
      qty: { ka: "რაოდ.", en: "Qty" },
      length: { ka: "სიგრძე", en: "Length" },
      width: { ka: "სიგანე", en: "Width" },
      thickness: { ka: "სისქე", en: "Thickness" },
    },
    parts: {
      side: { ka: "გვერდი", en: "Side" },
      top: { ka: "ზედა პანელი", en: "Top" },
      bottom: { ka: "ძირი", en: "Bottom" },
      shelf: { ka: "თარო", en: "Shelf" },
      back: { ka: "ზურგი", en: "Back" },
      plinth: { ka: "ცოკოლი", en: "Plinth" },
      door: { ka: "კარი", en: "Door" },
      drawerFront: { ka: "უჯრის ფასადი", en: "Drawer front" },
      drawerSide: { ka: "უჯრის გვერდი", en: "Drawer side" },
      drawerRail: { ka: "უჯრის კედელი", en: "Drawer rail" },
      drawerBottom: { ka: "უჯრის ძირი", en: "Drawer bottom" },
    },
    front: {
      label: { ka: "ფასადი", en: "Front" },
      none: { ka: "ღია", en: "Open" },
      doors: { ka: "კარები", en: "Doors" },
      drawers: { ka: "უჯრები", en: "Drawers" },
      doorCount: { ka: "კარების რაოდენობა", en: "Doors" },
      drawerCount: { ka: "უჯრების რაოდენობა", en: "Drawers" },
      reveal: { ka: "ღრეჩო", en: "Reveal" },
      carcassDecor: { ka: "კორპუსის დეკორი", en: "Carcass decor" },
      frontDecor: { ka: "ფასადის დეკორი", en: "Front decor" },
    },
    hardware: {
      title: { ka: "ფურნიტურა", en: "Hardware" },
      hinge: { ka: "ანჯამა", en: "Hinge" },
      slidePair: { ka: "მიმმართველი (წყვილი)", en: "Slide pair" },
    },
    decorColumn: { ka: "დეკორი", en: "Decor" },
    kitchen: {
      walls: { ka: "კედლები", en: "Walls" },
      wall: { ka: "კედელი", en: "Wall" },
      length: { ka: "სიგრძე", en: "Length" },
      wallHeight: { ka: "კედლის სიმაღლე", en: "Wall height" },
      bandHeight: {
        ka: "ზედაპირიდან საკიდებამდე",
        en: "Counter to wall units",
      },
      cabinets: { ka: "კარადები", en: "Cabinets" },
      presets: {
        baseDoors: { ka: "ქვედა · კარები", en: "Base · doors" },
        baseDrawers: { ka: "ქვედა · უჯრები", en: "Base · drawers" },
        sink: { ka: "ნიჟარა", en: "Sink" },
        oven: { ka: "ღუმელი", en: "Oven" },
        hob: { ka: "ქურა", en: "Hob" },
        fridge: { ka: "მაცივარი", en: "Fridge" },
        hood: { ka: "გამწოვი", en: "Hood" },
        wallUnit: { ka: "საკიდი", en: "Wall unit" },
        tallUnit: { ka: "მაღალი", en: "Tall unit" },
        space: { ka: "ღია სივრცე", en: "Space" },
      },
      duplicate: { ka: "დუბლირება", en: "Duplicate" },
      pdf: { ka: "PDF", en: "PDF" },
      print: { ka: "ბეჭდვა · PDF-ად შენახვა", en: "Print · Save as PDF" },
      packet: { ka: "სახელოსნო პაკეტი", en: "Workshop packet" },
      backToStudio: { ka: "სტუდიაში დაბრუნება", en: "Back to the studio" },
      summary: { ka: "შემადგენლობა", en: "Contents" },
      free: { ka: "თავისუფალია", en: "free" },
      plan: { ka: "გეგმა", en: "Plan" },
      elevations: { ka: "კედლის ხედები", en: "Wall elevations" },
      fullCutList: { ka: "სრული საჭრელი სია", en: "Full cut list" },
      card: { ka: "ასაწყობი ბარათი", en: "Assembly card" },
      remove: { ka: "წაშლა", en: "Remove" },
      saved: { ka: "შენახულია", en: "Saved" },
      saving: { ka: "ინახება…", en: "Saving…" },
      selectHint: {
        ka: "აირჩიე კარადა გეგმაზე ან სიაში",
        en: "Select a cabinet on the plan or in the list",
      },
    },
  },
} as const;
