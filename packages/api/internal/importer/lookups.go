package importer

import (
	"github.com/I0-1O/draba/packages/api/internal/models"
)

// BuildLookups inverts the target timeline/team's records into the normalized
// name-to-ID maps the resolver matches against — the mirror image of export's
// ID-to-name maps. Archived members are excluded: they cannot be assigned
// through the UI, so import must not resurrect them either.
func BuildLookups(statuses []*models.Status, members []*models.TeamMemberWithUser, tags []*models.Tag, activities []*models.Activity) Lookups {
	lk := Lookups{
		Statuses:          make(map[string]string, len(statuses)),
		MembersByName:     make(map[string][]string, len(members)),
		MembersByEmail:    make(map[string]string, len(members)),
		Tags:              make(map[string]string, len(tags)),
		ActivitiesByTitle: make(map[string][]string, len(activities)),
		ExistingKeys:      make(map[string]bool, len(activities)),
	}
	for _, st := range statuses {
		lk.Statuses[NormalizeName(st.Name)] = st.ID
	}
	for _, m := range members {
		if m.ArchivedAt != nil {
			continue
		}
		if n := NormalizeName(m.DisplayName); n != "" {
			lk.MembersByName[n] = append(lk.MembersByName[n], m.ID)
		}
		if e := NormalizeName(m.Email); e != "" {
			lk.MembersByEmail[e] = m.ID
		}
	}
	for _, t := range tags {
		lk.Tags[NormalizeName(t.Name)] = t.ID
	}
	for _, a := range activities {
		n := NormalizeName(a.Title)
		lk.ActivitiesByTitle[n] = append(lk.ActivitiesByTitle[n], a.ID)
		lk.ExistingKeys[DuplicateKey(a.Title, a.StartAt.Format(isoDate), a.EndAt.Format(isoDate))] = true
	}
	return lk
}
