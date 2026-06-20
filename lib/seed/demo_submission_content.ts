export interface DemoSubmissionTemplate {
  message: string;
  submitterName: string;
  socialHandle?: string;
}

export const DEMO_SUBMISSION_TEMPLATES: DemoSubmissionTemplate[] = [
  {
    message: "Proud to call Singapore home",
    submitterName: "Aisha Rahman",
    socialHandle: "@aisha.ndp",
  },
  { message: "NDP with the whole family!", submitterName: "Tan Wei Ming" },
  { message: "One people, one nation", submitterName: "Priya Sharma", socialHandle: "@priya.sg" },
  { message: "Celebrating our shared future", submitterName: "Marcus Lee" },
  {
    message: "Grateful for this little red dot",
    submitterName: "Siti Nurhaliza",
    socialHandle: "@siti_celebrates",
  },
  { message: "From heartlands to harbour — we belong", submitterName: "Raj Kumar" },
  { message: "Majulah! Happy National Day", submitterName: "Emily Wong", socialHandle: "@emilyw" },
  { message: "Our hawker centres, our home", submitterName: "Hassan Ibrahim" },
  {
    message: "Together we shine brighter",
    submitterName: "Mei Ling Chen",
    socialHandle: "@meiling",
  },
  { message: "Red and white forever", submitterName: "Arjun Patel" },
  { message: "Parade day vibes with the kids", submitterName: "Nurul Aminah" },
  {
    message: "Building dreams on this island",
    submitterName: "David Koh",
    socialHandle: "@davidk_sg",
  },
  { message: "Unity in diversity — that's us", submitterName: "Farah Aziz" },
  { message: "Fireworks and friends tonight", submitterName: "Benjamin Tan" },
  { message: "Thank you, Singapore", submitterName: "Lakshmi Venkat", socialHandle: "@lakshmi_v" },
  { message: "From east to west, we're one", submitterName: "Omar Hassan" },
  { message: "Growing up Singaporean", submitterName: "Chloe Ng" },
  { message: "Our stories, our home", submitterName: "Vikram Singh", socialHandle: "@vikram" },
  { message: "Celebrating with neighbours", submitterName: "Yasmin Ali" },
  { message: "Forever SG in my heart", submitterName: "Jonathan Lim" },
];

export function getDemoSubmissionContent(index: number): DemoSubmissionTemplate {
  const template = DEMO_SUBMISSION_TEMPLATES[index % DEMO_SUBMISSION_TEMPLATES.length];
  return { ...template };
}
