import { z } from 'zod'

export const uuidSchema = z.string().uuid({ message: 'common.uuid.invalid' })

const MAX_PAGE_SIZE = 50
const DEFAULT_PAGE_SIZE = 20

export const paginationSchema = z.object({
  limit: z
    .number({ message: 'common.pagination.invalid' })
    .int({ message: 'common.pagination.invalid' })
    .min(1, { message: 'common.pagination.invalid' })
    .max(MAX_PAGE_SIZE, { message: 'common.pagination.invalid' })
    .default(DEFAULT_PAGE_SIZE),
  offset: z
    .number({ message: 'common.pagination.invalid' })
    .int({ message: 'common.pagination.invalid' })
    .min(0, { message: 'common.pagination.invalid' })
    .default(0),
})

export const coordinatesSchema = z.object({
  lat: z
    .number({ message: 'common.coordinates.invalid' })
    .min(-90, { message: 'common.coordinates.invalid' })
    .max(90, { message: 'common.coordinates.invalid' }),
  lng: z
    .number({ message: 'common.coordinates.invalid' })
    .min(-180, { message: 'common.coordinates.invalid' })
    .max(180, { message: 'common.coordinates.invalid' }),
})

export type Pagination = z.infer<typeof paginationSchema>
export type Coordinates = z.infer<typeof coordinatesSchema>
