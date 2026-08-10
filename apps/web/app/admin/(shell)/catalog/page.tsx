import { CatalogView } from '../../../../components/admin/CatalogView'
import {
  fetchCatalog,
  fetchCategories,
  fetchCategoryPreview,
  fetchServiceDetail,
  fetchStatusPreview,
} from '../../../../lib/catalog/services'

// A04 — one route, two views: the list and `?service=<id>`, the same linkable
// scope A02's statement and A03's network screen use.
//
// ⚠ THE CONFIRM DIALOGS' NUMBERS ARE FETCHED HERE, on the server, keyed by
// `?to=` and `?category=`. They are not computed in the browser from the row
// the founder clicked, because A03's rule is that the number in the dialog IS
// the number the function will apply — and the only way to guarantee that is
// for both to come from the same function.

export const dynamic = 'force-dynamic'

type Search = { service?: string; to?: string; category?: string; categoryTo?: string }

function asStatus(value: string | undefined): 'draft' | 'published' | 'suspended' | null {
  return value === 'draft' || value === 'published' || value === 'suspended' ? value : null
}

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const params = await searchParams
  const serviceId = params.service
  const to = asStatus(params.to)
  const categoryId = params.category
  const categoryTo = params.categoryTo === 'true'

  const [catalog, categories] = await Promise.all([fetchCatalog(), fetchCategories()])

  const detail = serviceId === undefined ? null : await fetchServiceDetail(serviceId)
  const statusPreview =
    serviceId !== undefined && to !== null && detail !== null
      ? await fetchStatusPreview(serviceId, to)
      : null
  const categoryPreview =
    categoryId === undefined ? null : await fetchCategoryPreview(categoryId, categoryTo)

  return (
    <CatalogView
      services={catalog.services}
      counts={catalog.counts}
      categories={categories}
      detail={detail}
      statusPreview={statusPreview}
      categoryPreview={categoryPreview}
    />
  )
}
