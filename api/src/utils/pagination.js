/**
 * Standard pagination helpers shared by every paginated list endpoint.
 * Response wrapper shape: { data: [...], meta: { page, limit, total, totalPages } }
 */

export function paginationMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export function paginated(data, { page, limit, total }) {
  return { data, meta: paginationMeta({ page, limit, total }) };
}

export function offset(page, limit) {
  return (page - 1) * limit;
}
