import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { DomainGroup } from "../lib/linkGrouping";

interface DomainGroupsProps {
    groups: DomainGroup[];
    onRemoveLink?: (linkId: string) => void;
}

function linkHref(url: string) {
    return /^[a-z][a-z\d+.-]*:\/\//i.test(url) ? url : `https://${url}`;
}

function formatSavedAt(date: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(date));
}

export function DomainGroups({ groups, onRemoveLink }: DomainGroupsProps) {
    return (
        <Stack className="domain-groups" spacing={1.25}>
            {groups.map((group, index) => {
                const headingId = `domain-heading-${index}`;
                const panelId = `domain-panel-${index}`;
                return (
                    <Accordion
                        key={group.domain}
                        defaultExpanded
                        disableGutters
                        aria-labelledby={headingId}
                    >
                        <AccordionSummary
                            id={headingId}
                            aria-controls={panelId}
                            expandIcon={<ExpandMoreRoundedIcon />}
                        >
                            <Stack
                                direction="row"
                                spacing={1.5}
                                sx={{ minWidth: 0, flex: 1, alignItems: "center" }}
                            >
                                <Avatar className="domain-avatar" aria-hidden="true">
                                    {group.domain[0].toUpperCase()}
                                </Avatar>
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography
                                        component="span"
                                        role="heading"
                                        aria-level={3}
                                        className="domain-title"
                                        sx={{ m: 0 }}
                                    >
                                        {group.domain}
                                    </Typography>
                                    <Typography className="domain-subtitle">
                                        {group.links.length}{" "}
                                        {group.links.length === 1 ? "saved link" : "saved links"}
                                    </Typography>
                                </Box>
                            </Stack>
                        </AccordionSummary>
                        <AccordionDetails id={panelId} className="domain-links">
                            {group.links.map((link) => (
                                <Stack
                                    className="saved-link"
                                    component="article"
                                    direction="row"
                                    spacing={1.75}
                                    key={link.id}
                                    sx={{ alignItems: "center" }}
                                >
                                    <ArrowOutwardRoundedIcon
                                        className="link-number"
                                        aria-hidden="true"
                                    />
                                    <Box className="saved-copy">
                                        <Typography
                                            component="a"
                                            href={linkHref(link.url)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="saved-title"
                                        >
                                            {link.title}
                                            <span aria-hidden="true"> ↗</span>
                                        </Typography>
                                        <Typography component="p" className="link-url">
                                            {link.url}
                                        </Typography>
                                        {link.note && (
                                            <Typography component="p" className="saved-note">
                                                {link.note}
                                            </Typography>
                                        )}
                                    </Box>
                                    <Typography className="saved-date">
                                        {formatSavedAt(link.createdAt)}
                                    </Typography>
                                    {onRemoveLink && (
                                        <IconButton
                                            aria-label={`Remove ${link.title}`}
                                            onClick={() => onRemoveLink(link.id)}
                                            size="small"
                                        >
                                            <DeleteOutlineRoundedIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Stack>
                            ))}
                        </AccordionDetails>
                    </Accordion>
                );
            })}
        </Stack>
    );
}
