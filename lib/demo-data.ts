// Demo data service for when Supabase is not configured
interface Bowl {
  id: string
  woodType: string
  woodSource: string
  dateMade: string
  finishes: string[]
  comments: string
  images: string[]
  createdAt: string
}

const DEMO_BOWLS: Bowl[] = [
  {
    id: "demo-1",
    woodType: "Cherry",
    woodSource: "Local sawmill",
    dateMade: "2024-01-15",
    finishes: ["Tung oil", "Carnauba wax"],
    comments: "Beautiful grain pattern with natural edge. First attempt at a natural edge bowl.",
    images: ["/placeholder.svg?height=400&width=600"],
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "demo-2",
    woodType: "Walnut",
    woodSource: "Backyard tree",
    dateMade: "2024-02-03",
    finishes: ["Danish oil"],
    comments: "Deep chocolate color with stunning grain. Made from a tree that fell in our yard.",
    images: ["/placeholder.svg?height=400&width=600"],
    createdAt: "2024-02-03T14:30:00Z",
  },
  {
    id: "demo-3",
    woodType: "Maple",
    woodSource: "Lumber yard",
    dateMade: "2024-02-20",
    finishes: ["Polyurethane", "Food safe finish"],
    comments: "Light colored bowl perfect for serving. Very smooth finish achieved.",
    images: ["/placeholder.svg?height=400&width=600"],
    createdAt: "2024-02-20T09:15:00Z",
  },
]

export const getDemoBowls = (): Bowl[] => {
  return DEMO_BOWLS
}

export const getDemoBowl = (id: string): Bowl | null => {
  return DEMO_BOWLS.find((bowl) => bowl.id === id) || null
}
