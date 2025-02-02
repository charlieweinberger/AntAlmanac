import { ContentPasteGo } from '@mui/icons-material';
import { TabContext, TabPanel } from '@mui/lab';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Paper,
    Tab,
    Tabs,
    Tooltip,
} from '@mui/material';
import { CourseInfo } from '@packages/antalmanac-types';
import { useCallback, useEffect, useState } from 'react';

import TermSelector from '../../RightPane/CoursePane/SearchForm/TermSelector';
import RightPaneStore from '../../RightPane/RightPaneStore';

import { addCustomEvent, openSnackbar, addCourse } from '$actions/AppStoreActions';
import { ImportTabContent } from '$components/Header/import/ImportTabContent';
import analyticsEnum, { logAnalytics } from '$lib/analytics';
import { QueryZotcourseError } from '$lib/customErrors';
import { warnMultipleTerms } from '$lib/helpers';
import { WebSOC } from '$lib/websoc';
import { ZotcourseResponse, queryZotcourse } from '$lib/zotcourse';
import AppStore from '$stores/AppStore';

export enum ImportSource {
    StudyList = 'Study List',
    Zotcourse = 'Zotcourse',
}

export function Import() {
    const [skeletonMode, setSkeletonMode] = useState(() => AppStore.getSkeletonMode());

    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState(RightPaneStore.getFormData().term);
    const [importSource, setImportSource] = useState<ImportSource>(ImportSource.StudyList);
    const [studyListText, setStudyListText] = useState('');
    const [zotcourseScheduleName, setZotcourseScheduleName] = useState('');

    const handleOpen = useCallback(() => {
        setOpen(true);
    }, []);

    const handleClose = useCallback(() => {
        setOpen(false);
    }, []);

    const handleSubmit = useCallback(async () => {
        const currentSchedule = AppStore.getCurrentScheduleIndex();

        const isZotcourseImport = importSource === 'Zotcourse';
        let sectionCodes: string[] | null = null;

        if (isZotcourseImport) {
            try {
                const zotcourseImport: ZotcourseResponse = await queryZotcourse(zotcourseScheduleName);
                sectionCodes = zotcourseImport.codes;
                for (const event of zotcourseImport.customEvents) {
                    addCustomEvent(event, [currentSchedule]);
                }
            } catch (e) {
                if (e instanceof QueryZotcourseError) {
                    openSnackbar('error', e.message);
                } else {
                    openSnackbar('error', 'Could not import from Zotcourse.');
                }
                console.error(e);
                handleClose();
                return;
            }
        } else {
            // Is importing from Study List
            sectionCodes = studyListText.match(/\d{5}/g);
        }

        if (!sectionCodes) {
            openSnackbar('error', `Cannot import an empty ${isZotcourseImport ? 'Zotcourse' : 'Study List'}.`);
            handleClose();
            return;
        }

        try {
            const sectionsAdded = addCoursesMultiple(
                await WebSOC.getCourseInfo({
                    term: term,
                    sectionCodes: sectionCodes.join(','),
                }),
                term,
                currentSchedule
            );

            logAnalytics({
                category: analyticsEnum.nav.title,
                action: analyticsEnum.nav.actions.IMPORT_STUDY_LIST,
                value: sectionsAdded / (sectionCodes.length || 1),
            });

            if (sectionsAdded === sectionCodes.length) {
                openSnackbar('success', `Successfully imported ${sectionsAdded} of ${sectionsAdded} classes!`);
            } else if (sectionsAdded !== 0) {
                openSnackbar(
                    'warning',
                    `Only successfully imported ${sectionsAdded} of ${sectionCodes.length} classes. 
                        Please make sure that you selected the correct term and that none of your classes are missing.`
                );
            } else {
                openSnackbar(
                    'error',
                    'Failed to import any classes! Please make sure that you pasted the correct Study List.'
                );
            }
        } catch (e) {
            openSnackbar('error', 'An error occurred while trying to import the Study List.');
            console.error(e);
        }

        setStudyListText('');
        handleClose();
    }, []);

    const addCoursesMultiple = (
        courseInfo: { [sectionCode: string]: CourseInfo },
        term: string,
        scheduleIndex: number
    ) => {
        for (const section of Object.values(courseInfo)) {
            addCourse(section.section, section.courseDetails, term, scheduleIndex, true);
        }

        const terms = AppStore.termsInSchedule(term);
        if (terms.size > 1) {
            warnMultipleTerms(terms);
        }

        return Object.values(courseInfo).length;
    };

    const handleImportSourceChange = useCallback((_: React.SyntheticEvent, value: ImportSource) => {
        setImportSource(value);
    }, []);

    useEffect(() => {
        const handleSkeletonModeChange = () => {
            setSkeletonMode(AppStore.getSkeletonMode());
        };

        AppStore.on('skeletonModeChange', handleSkeletonModeChange);

        return () => {
            AppStore.off('skeletonModeChange', handleSkeletonModeChange);
        };
    }, []);

    return (
        <>
            <Tooltip title="Import a schedule from your Study List">
                <Button
                    onClick={handleOpen}
                    color="inherit"
                    startIcon={<ContentPasteGo />}
                    disabled={skeletonMode}
                    id="import-button"
                >
                    Import
                </Button>
            </Tooltip>

            <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
                <DialogTitle>Import Schedule</DialogTitle>

                <DialogContent>
                    <TabContext value={importSource}>
                        <Paper elevation={0} variant="outlined" square sx={{ borderRadius: '4px 4px 0 0' }}>
                            <Tabs value={importSource} onChange={handleImportSourceChange} variant="fullWidth">
                                <Tab label="From Study List" value={ImportSource.StudyList} />
                                <Tab label="From Zotcourse" value={ImportSource.Zotcourse} />
                            </Tabs>
                        </Paper>

                        <TabPanel value={ImportSource.StudyList} sx={{ paddingX: 0 }}>
                            <ImportTabContent
                                value={studyListText}
                                setValue={setStudyListText}
                                importSource={ImportSource.StudyList}
                            >
                                <DialogContentText>
                                    Paste the contents of your Study List below to import it into AntAlmanac.
                                    <br />
                                    To find your Study List, go to{' '}
                                    <a href={'https://www.reg.uci.edu/cgi-bin/webreg-redirect.sh'}>WebReg</a> or{' '}
                                    <a href={'https://www.reg.uci.edu/access/student/welcome/'}>StudentAccess</a>, and
                                    click on Study List once you&apos;ve logged in. Copy everything below the column
                                    names (Code, Dept, etc.) under the Enrolled Classes section.
                                </DialogContentText>
                            </ImportTabContent>
                        </TabPanel>

                        <TabPanel value={ImportSource.Zotcourse} sx={{ paddingX: 0 }}>
                            <ImportTabContent
                                value={zotcourseScheduleName}
                                setValue={setZotcourseScheduleName}
                                importSource={ImportSource.Zotcourse}
                            >
                                <DialogContentText>
                                    Paste your Zotcourse schedule name below to import it into AntAlmanac.
                                </DialogContentText>
                            </ImportTabContent>
                        </TabPanel>
                    </TabContext>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <DialogContentText>Make sure you also have the right term selected.</DialogContentText>
                        <TermSelector changeTerm={setTerm} fieldName={'selectedTerm'} />
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button color="inherit" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button color="inherit" onClick={handleSubmit}>
                        Import
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
